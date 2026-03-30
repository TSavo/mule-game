import {
  AUCTION_RESOURCE_ORDER,
  AUCTION_TICK_SCALE,
  AUCTION_MAX_OUT_OF_AUCTION,
  AUCTION_TIMER_MS,
  AUCTION_TIMER_SLOW_SPEED,
  AUCTION_SPEED_UP_DELAY_MS,
  TRANSACTION_TIME_START_MS,
  TRANSACTION_TIME_MS,
  TRANSACTION_TIME_DECREASE_MS,
  TRANSACTION_MIN_TIME_MS,
  TRANSACTION_GRACE_MS,
  TRANSACTION_GRACE_DECREASE_MS,
  TRANSACTION_GRACE_MIN_MS,
  FOOD_REQUIRED_BY_ROUND,
  ENERGY_PER_MULE,
  STORE_MAX_RESOURCE,
  getAuctionPriceStep,
  getStoreBuyPrice,
  getStoreSellPrice,
  ResourceType,
} from "@mule-game/shared";
import type { GameState } from "../state/GameState.js";

// ── Tick ↔ Price conversion ──────────────────────────────────────────────

export function tickToPrice(tick: number, startPrice: number, resource: ResourceType): number {
  const step = getAuctionPriceStep(resource);
  return startPrice + Math.floor(tick / AUCTION_TICK_SCALE) * step;
}

export function priceToMinTick(price: number, startPrice: number, resource: ResourceType): number {
  const step = getAuctionPriceStep(resource);
  return Math.floor((price - startPrice) / step) * AUCTION_TICK_SCALE;
}

export function priceToMaxTick(price: number, startPrice: number, resource: ResourceType): number {
  const step = getAuctionPriceStep(resource);
  return Math.floor((step + price - startPrice) / step) * AUCTION_TICK_SCALE - 1;
}

// ── Critical level (determines auto buyer/seller assignment) ─────────────

function getCriticalAmount(player: any, resource: ResourceType, round: number): number {
  switch (resource) {
    case ResourceType.Food:
      return FOOD_REQUIRED_BY_ROUND[Math.min(round + 1, FOOD_REQUIRED_BY_ROUND.length - 1)] ?? 3;
    case ResourceType.Energy: {
      // Energy requirement = number of installed mules * ENERGY_PER_MULE + 1
      // Approximate: use plotCount as proxy for installed mules
      const energyReq = (player.plotCount ?? 0) * ENERGY_PER_MULE;
      return energyReq + 1;
    }
    case ResourceType.Smithore:
    case ResourceType.Crystite:
      return 0;
  }
}

// ── TradingAuctionPhase ─────────────────────────────────────────────────

export class TradingAuctionPhase {
  private resourceIndex = 0;

  // Tick state per player: { [playerIndex]: tick }
  private playerTicks = new Map<number, number>();
  // Whether each player is in the auction area
  private playerInArena = new Map<number, boolean>();
  // Whether each player has moved this frame
  private playerMoving = new Map<number, boolean>();

  // Auction limits for current resource
  private startPrice = 0;    // store buy price (floor)
  private minTick = 0;       // tick at store buy price
  private maxTick = 0;       // tick at store sell price

  // Timer state (elapsed ms tracking)
  private timerElapsedMs = 0;
  private lastTimerSpeedChangeMs = 0;
  private transacting = false;

  // Transaction cooldown/acceleration
  private transactionDeadlineMs = 0; // when next trade can fire
  private tradeCooldownMs = 0;

  // Average price tracking
  private totalUnitsTraded = 0;
  private totalUnitsPrice = 0;

  // ── Lifecycle ──

  start(state: GameState): void {
    this.resourceIndex = 0;
    this.startResourceAuction(state);
  }

  private startResourceAuction(state: GameState): void {
    // Skip resources nobody has and store doesn't have
    while (this.resourceIndex < AUCTION_RESOURCE_ORDER.length) {
      const resource = AUCTION_RESOURCE_ORDER[this.resourceIndex];
      let hasSeller = false;
      state.players.forEach((p: any) => {
        if (this.getPlayerResource(p, resource) > 0) hasSeller = true;
      });
      const storeHas = this.getStoreResource(state, resource) > 0;
      if (hasSeller || storeHas) break;
      this.resourceIndex++;
    }

    if (this.resourceIndex >= AUCTION_RESOURCE_ORDER.length) {
      state.auction.active = false;
      return;
    }

    const resource = AUCTION_RESOURCE_ORDER[this.resourceIndex];
    const storeStock = this.getStoreResource(state, resource);
    let totalPlayerStock = 0;
    state.players.forEach((p: any) => {
      totalPlayerStock += this.getPlayerResource(p, resource);
    });
    const buyPrice = getStoreBuyPrice(resource, storeStock, totalPlayerStock);
    const sellPriceOrNull = getStoreSellPrice(resource, storeStock, totalPlayerStock);
    const sellPrice = sellPriceOrNull ?? buyPrice; // if no store stock, sell=buy (no ceiling)

    this.startPrice = buyPrice;
    this.minTick = priceToMinTick(buyPrice, buyPrice, resource);
    this.maxTick = sellPriceOrNull != null
      ? priceToMaxTick(sellPrice, buyPrice, resource)
      : priceToMinTick(buyPrice, buyPrice, resource); // collapsed range when no stock

    // Reset state
    this.playerTicks.clear();
    this.playerInArena.clear();
    this.playerMoving.clear();
    this.timerElapsedMs = 0;
    this.lastTimerSpeedChangeMs = 0;
    this.transacting = false;
    this.transactionDeadlineMs = 0;
    this.tradeCooldownMs = 0;
    this.totalUnitsTraded = 0;
    this.totalUnitsPrice = 0;

    // Update auction schema
    state.auction.resource = resource;
    state.auction.active = true;
    state.auction.subPhase = "declare";
    state.auction.currentResourceIndex = this.resourceIndex;
    state.auction.storeUnits = storeStock;
    state.auction.storeBuyPrice = buyPrice;
    state.auction.storeSellPrice = sellPriceOrNull ?? -1;
    state.auction.storeClosed = sellPriceOrNull == null;
    state.auction.buyTick = -1;
    state.auction.sellTick = -1;
    state.auction.unitsTraded = 0;
    state.auction.lastTradePrice = -1;
    state.auction.timerSpeed = 1.0;
    state.auction.timerPaused = false;

    // Auto-assign roles based on surplus/shortage
    const round = state.round ?? 0;
    state.players.forEach((p: any) => {
      const amount = this.getPlayerResource(p, resource);
      const critical = getCriticalAmount(p, resource, round);
      if (amount > critical) {
        // Has surplus → seller
        p.auctionRole = "seller";
        p.auctionTick = AUCTION_MAX_OUT_OF_AUCTION;
        p.auctionInArena = false;
      } else {
        // Needs more → buyer
        p.auctionRole = "buyer";
        p.auctionTick = -AUCTION_MAX_OUT_OF_AUCTION;
        p.auctionInArena = false;
      }
      this.playerTicks.set(p.index, p.auctionTick);
      this.playerInArena.set(p.index, false);
      this.playerMoving.set(p.index, false);
    });
  }

  // ── Declaration ──

  declare(state: GameState, playerIndex: number, role: "buyer" | "seller"): void {
    const player = state.players.get(String(playerIndex));
    if (!player) return;
    const resource = state.auction.resource;

    // Cannot become seller with 0 resources
    if (role === "seller" && this.getPlayerResource(player, resource) <= 0) return;

    player.auctionRole = role;
    if (role === "seller") {
      player.auctionTick = AUCTION_MAX_OUT_OF_AUCTION;
    } else {
      player.auctionTick = -AUCTION_MAX_OUT_OF_AUCTION;
    }
    player.auctionInArena = false;
    this.playerTicks.set(playerIndex, player.auctionTick);
    this.playerInArena.set(playerIndex, false);
  }

  startTrading(state: GameState): void {
    state.auction.subPhase = "trading";
    this.timerElapsedMs = 0;
    state.auction.timeRemaining = AUCTION_TIMER_MS;
    state.auction.timerSpeed = 1.0;
    state.auction.timerPaused = false;
  }

  // ── Player movement (called from game loop) ──

  movePlayer(state: GameState, playerIndex: number, direction: "up" | "down" | "none"): void {
    // Always allow clearing the moving flag
    if (direction === "none") {
      this.playerMoving.set(playerIndex, false);
      return;
    }

    const player = state.players.get(String(playerIndex));
    if (!player || state.auction.subPhase !== "trading") return;

    const resource = state.auction.resource as ResourceType;
    const isBuyer = player.auctionRole === "buyer";
    const isSeller = player.auctionRole === "seller";
    if (!isBuyer && !isSeller) return;

    let tick = this.playerTicks.get(playerIndex) ?? 0;
    let inArena = this.playerInArena.get(playerIndex) ?? false;

    this.playerMoving.set(playerIndex, true);

    // (dead code removed — "none" handled above)

    // Apply movement: 1 tick per call (caller calls multiple times per frame for speed)
    if (direction === "up") tick += 1;
    else tick -= 1;

    // Boundary logic
    if (isBuyer) {
      if (!inArena) {
        // Outside auction, below
        if (tick >= 0) {
          inArena = true;
          tick = this.minTick + tick; // enter at bottom
        } else if (tick < -AUCTION_MAX_OUT_OF_AUCTION) {
          tick = -AUCTION_MAX_OUT_OF_AUCTION;
        }
      }
      if (inArena) {
        // Cannot exceed current sell tick
        const currentSellTick = this.calcSellTick(state);
        if (currentSellTick >= 0 && tick > currentSellTick) tick = currentSellTick;
        // Cannot exceed what player can afford
        const price = tickToPrice(tick, this.startPrice, resource);
        if (price > player.money) {
          const affordTick = priceToMaxTick(player.money, this.startPrice, resource);
          if (affordTick < this.minTick) {
            inArena = false;
            tick = -1;
          } else {
            tick = affordTick;
          }
        }
        // Cannot go below minTick
        if (tick < this.minTick) {
          inArena = false;
          tick = -1;
        }
      }
    } else if (isSeller) {
      if (!inArena) {
        // Outside auction, above
        if (tick <= 0) {
          inArena = true;
          tick = this.maxTick + tick; // enter at top
        } else if (tick > AUCTION_MAX_OUT_OF_AUCTION) {
          tick = AUCTION_MAX_OUT_OF_AUCTION;
        }
      }
      if (inArena) {
        // Cannot go below current buy tick
        const currentBuyTick = this.calcBuyTick(state);
        if (currentBuyTick >= 0 && tick < currentBuyTick) tick = currentBuyTick;
        // Cannot go below minTick
        if (tick < this.minTick) tick = this.minTick;
        // Cannot exceed maxTick (exit arena if above)
        if (tick > this.maxTick) {
          inArena = false;
          tick = tick - this.maxTick;
        }
        // Cannot enter with 0 resources
        if (this.getPlayerResource(player, resource) <= 0) {
          inArena = false;
          tick = 1;
        }
      }
    }

    this.playerTicks.set(playerIndex, tick);
    this.playerInArena.set(playerIndex, inArena);
    player.auctionTick = tick;
    player.auctionInArena = inArena;
  }

  // ── Tick calculation ──

  /** Highest buyer tick among players in the arena */
  calcBuyTick(state: GameState): number {
    let highest = -1;
    const resource = state.auction.resource as ResourceType;
    state.players.forEach((p: any) => {
      if (p.auctionRole === "buyer" && (this.playerInArena.get(p.index) ?? false)) {
        const tick = this.playerTicks.get(p.index) ?? 0;
        if (tick > highest) highest = tick;
      }
    });
    // Store buy tick acts as floor (store always buys at its buy price)
    const storeBuyTick = priceToMinTick(this.startPrice, this.startPrice, resource);
    if (storeBuyTick > highest && storeBuyTick >= this.minTick) {
      highest = storeBuyTick;
    }
    return highest;
  }

  /** Lowest seller tick among players in the arena */
  calcSellTick(state: GameState): number {
    let lowest = Infinity;
    const resource = state.auction.resource as ResourceType;
    state.players.forEach((p: any) => {
      if (p.auctionRole === "seller" && (this.playerInArena.get(p.index) ?? false)) {
        const tick = this.playerTicks.get(p.index) ?? 0;
        if (tick < lowest) lowest = tick;
      }
    });
    // Store sell tick acts as ceiling (if store has stock)
    const storeStock = this.getStoreResource(state, resource);
    if (storeStock > 0 && state.auction.storeSellPrice > 0) {
      const storeSellTick = priceToMaxTick(state.auction.storeSellPrice, this.startPrice, resource);
      if (storeSellTick < lowest) {
        lowest = storeSellTick;
      }
    }
    return lowest === Infinity ? -1 : lowest;
  }

  /** Update buy/sell ticks on auction state and return whether they meet */
  updateBuySellTicks(state: GameState): boolean {
    const buyTick = this.calcBuyTick(state);
    const sellTick = this.calcSellTick(state);
    state.auction.buyTick = buyTick;
    state.auction.sellTick = sellTick;
    return buyTick >= 0 && sellTick >= 0 && buyTick >= sellTick;
  }

  // ── Timer management ──

  /** Call each frame with delta in ms. Returns true when auction time expires. */
  updateTimer(state: GameState, deltaMs: number, forceFullSpeed = false): boolean {
    if (state.auction.subPhase !== "trading") return false;

    if (this.transacting && !forceFullSpeed) {
      state.auction.timerPaused = true;
      state.auction.timerSpeed = 0;
      return false;
    }

    state.auction.timerPaused = false;

    if (forceFullSpeed) {
      // Server-side: always full speed (slow-down is for human UI only)
      state.auction.timerSpeed = 1.0;
    } else {
      // Client-driven: check if anyone is moving in the arena
      let anyoneMoving = false;
      state.players.forEach((p: any) => {
        if (this.playerMoving.get(p.index) && (this.playerInArena.get(p.index) ?? false)) {
          anyoneMoving = true;
        }
      });

      if (anyoneMoving) {
        state.auction.timerSpeed = AUCTION_TIMER_SLOW_SPEED;
        this.lastTimerSpeedChangeMs = 0;
      } else {
        this.lastTimerSpeedChangeMs += deltaMs;
        if (this.lastTimerSpeedChangeMs >= AUCTION_SPEED_UP_DELAY_MS) {
          state.auction.timerSpeed = 1.0;
        }
      }
    }

    this.timerElapsedMs += deltaMs * state.auction.timerSpeed;
    const remaining = Math.max(0, AUCTION_TIMER_MS - this.timerElapsedMs);
    state.auction.timeRemaining = Math.round(remaining);

    return remaining <= 0;
  }

  // ── Transaction mechanics ──

  /**
   * Check for and execute trades. Returns trade info if a trade happened.
   * Call every frame during "trading" subPhase.
   */
  checkForTrades(state: GameState, nowMs: number = Date.now()): { seller: number; buyer: number; price: number; fromStore: boolean; toStore: boolean } | null {
    if (state.auction.subPhase !== "trading") return null;

    const ticksMeet = this.updateBuySellTicks(state);
    if (!ticksMeet) {
      // Ticks diverged — stop any active transaction
      if (this.transacting) {
        this.transacting = false;
        state.auction.timerPaused = false;
        state.auction.subPhase = "trading";
      }
      return null;
    }

    const buyTick = state.auction.buyTick;
    const resource = state.auction.resource as ResourceType;
    const tradePrice = tickToPrice(buyTick, this.startPrice, resource);

    // Check transaction timing
    const delay = this.calcTransactionDelay(state.auction.unitsTraded);
    if (!this.transacting) {
      // Begin transaction: pause timer, start cooldown
      this.transacting = true;
      this.transactionDeadlineMs = nowMs + delay;
      state.auction.timerPaused = true;
      state.auction.subPhase = "transaction";
    }

    if (nowMs < this.transactionDeadlineMs) return null;

    // Time to execute the trade — find best buyer and seller
    const { buyerIdx, sellerIdx, fromStore, toStore } = this.findTraders(state, buyTick, tradePrice, resource);
    if (buyerIdx === -1 && sellerIdx === -1) return null;

    // Execute
    const success = this.executeTradeInternal(state, sellerIdx, buyerIdx, resource, tradePrice, fromStore, toStore);
    if (!success) return null;

    // Track
    state.auction.unitsTraded += 1;
    state.auction.lastTradePrice = tradePrice;
    this.totalUnitsTraded += 1;
    this.totalUnitsPrice += tradePrice;

    // Grace period — set next deadline
    const grace = this.calcGracePeriod(state.auction.unitsTraded);
    this.transactionDeadlineMs = nowMs + grace + this.calcTransactionDelay(state.auction.unitsTraded);

    return { seller: sellerIdx, buyer: buyerIdx, price: tradePrice, fromStore, toStore };
  }

  private calcTransactionDelay(unitsTraded: number): number {
    if (unitsTraded === 0) return TRANSACTION_TIME_START_MS;
    let delay = TRANSACTION_TIME_MS - unitsTraded * TRANSACTION_TIME_DECREASE_MS;
    return Math.max(delay, TRANSACTION_MIN_TIME_MS);
  }

  private calcGracePeriod(unitsTraded: number): number {
    if (unitsTraded <= 0) return TRANSACTION_GRACE_MS;
    let grace = TRANSACTION_GRACE_MS - (unitsTraded - 1) * TRANSACTION_GRACE_DECREASE_MS;
    return Math.max(grace, TRANSACTION_GRACE_MIN_MS);
  }

  private findTraders(
    state: GameState,
    tradeTick: number,
    tradePrice: number,
    resource: ResourceType,
  ): { buyerIdx: number; sellerIdx: number; fromStore: boolean; toStore: boolean } {
    // Find players at the trade tick
    const buyers: number[] = [];
    const sellers: number[] = [];

    state.players.forEach((p: any) => {
      if (p.auctionRole === "buyer" && (this.playerInArena.get(p.index) ?? false)) {
        const tick = this.playerTicks.get(p.index) ?? 0;
        if (tick >= tradeTick && p.money >= tradePrice) buyers.push(p.index);
      }
      if (p.auctionRole === "seller" && (this.playerInArena.get(p.index) ?? false)) {
        const tick = this.playerTicks.get(p.index) ?? 0;
        if (tick <= tradeTick && this.getPlayerResource(p, resource) > 0) sellers.push(p.index);
      }
    });

    // Player-to-player trade takes priority
    if (buyers.length > 0 && sellers.length > 0) {
      return { buyerIdx: buyers[0], sellerIdx: sellers[0], fromStore: false, toStore: false };
    }

    // Store as seller (buyer exists but no player seller)
    const storeStock = this.getStoreResource(state, resource);
    if (buyers.length > 0 && storeStock > 0 && state.auction.storeSellPrice > 0) {
      const storeSellTick = priceToMaxTick(state.auction.storeSellPrice, this.startPrice, resource);
      if (storeSellTick <= tradeTick || tradeTick >= storeSellTick) {
        return { buyerIdx: buyers[0], sellerIdx: -1, fromStore: true, toStore: false };
      }
    }

    // Store as buyer (seller exists but no player buyer)
    if (sellers.length > 0) {
      const storeBuyTick = priceToMinTick(this.startPrice, this.startPrice, resource);
      if (storeBuyTick >= tradeTick || tradeTick <= storeBuyTick) {
        return { buyerIdx: -1, sellerIdx: sellers[0], fromStore: false, toStore: true };
      }
    }

    return { buyerIdx: -1, sellerIdx: -1, fromStore: false, toStore: false };
  }

  // ── Trade execution ──

  executeTrade(state: GameState, sellerIndex: number, buyerIndex: number, resource: string, price: number): boolean {
    return this.executeTradeInternal(state, sellerIndex, buyerIndex, resource as ResourceType, price, false, false);
  }

  private executeTradeInternal(
    state: GameState,
    sellerIndex: number,
    buyerIndex: number,
    resource: ResourceType,
    price: number,
    fromStore: boolean,
    toStore: boolean,
  ): boolean {
    if (fromStore) {
      return this.buyFromStore(state, buyerIndex, price);
    }
    if (toStore) {
      return this.sellToStore(state, sellerIndex, price);
    }

    // Player-to-player
    const seller = state.players.get(String(sellerIndex));
    const buyer = state.players.get(String(buyerIndex));
    if (!seller || !buyer) return false;
    const sellerAmount = this.getPlayerResource(seller, resource);
    if (sellerAmount <= 0 || buyer.money < price) return false;
    this.setPlayerResource(seller, resource, sellerAmount - 1);
    this.setPlayerResource(buyer, resource, this.getPlayerResource(buyer, resource) + 1);
    seller.money += price;
    buyer.money -= price;

    // If seller runs out, push them out of arena
    if (this.getPlayerResource(seller, resource) <= 0) {
      this.playerInArena.set(sellerIndex, false);
      this.playerTicks.set(sellerIndex, 1);
      seller.auctionInArena = false;
      seller.auctionTick = 1;
    }

    return true;
  }

  buyFromStore(state: GameState, playerIndex: number, priceOverride?: number): boolean {
    const resource = state.auction.resource as ResourceType;
    const storeStock = this.getStoreResource(state, resource);
    if (storeStock <= 0) return false;
    const price = priceOverride ?? state.auction.storeSellPrice;
    if (price <= 0) return false;

    const player = state.players.get(String(playerIndex));
    if (!player || player.money < price) return false;

    player.money -= price;
    this.setPlayerResource(player, resource, this.getPlayerResource(player, resource) + 1);
    this.setStoreResource(state, resource, storeStock - 1);
    state.auction.storeUnits = this.getStoreResource(state, resource);

    // Check store exhaustion
    if (this.getStoreResource(state, resource) <= 0) {
      state.auction.storeSellPrice = -1;
      state.auction.storeClosed = true;
      // Expand auction range upward
      this.expandRangeOnStoreExhaustion(state);
    }

    return true;
  }

  sellToStore(state: GameState, playerIndex: number, priceOverride?: number): boolean {
    const resource = state.auction.resource as ResourceType;
    const player = state.players.get(String(playerIndex));
    if (!player) return false;
    const playerAmount = this.getPlayerResource(player, resource);
    if (playerAmount <= 0) return false;

    const price = priceOverride ?? state.auction.storeBuyPrice;

    player.money += price;
    this.setPlayerResource(player, resource, playerAmount - 1);

    // Crystite vanishes when sold to store (store never accumulates crystite)
    // Non-crystite resources cap at STORE_MAX_RESOURCE
    if (resource !== ResourceType.Crystite) {
      const current = this.getStoreResource(state, resource);
      if (current >= STORE_MAX_RESOURCE) return false;
      this.setStoreResource(state, resource, current + 1);
    }
    state.auction.storeUnits = this.getStoreResource(state, resource);

    return true;
  }

  private expandRangeOnStoreExhaustion(state: GameState): void {
    // When store runs out, remove the ceiling — expand maxTick upward
    // This allows prices to exceed the former store sell price
    const resource = state.auction.resource as ResourceType;
    const oldMaxPrice = tickToPrice(this.maxTick, this.startPrice, resource);
    // Extend by the full price range (double the ceiling)
    const newMaxPrice = oldMaxPrice + (oldMaxPrice - this.startPrice);
    this.maxTick = priceToMaxTick(newMaxPrice, this.startPrice, resource);
  }

  // ── Resource round management ──

  advanceToNextResource(state: GameState): void {
    // Record average price for this resource before advancing
    this.recordAveragePrice(state);
    this.resourceIndex++;
    this.startResourceAuction(state);
  }

  private recordAveragePrice(state: GameState): void {
    if (this.totalUnitsTraded <= 0) return;
    const avgPrice = Math.round(this.totalUnitsPrice / this.totalUnitsTraded);
    const resource = state.auction.resource as ResourceType;
    switch (resource) {
      case ResourceType.Food: state.store.foodAvgPrice = avgPrice; break;
      case ResourceType.Energy: state.store.energyAvgPrice = avgPrice; break;
      case ResourceType.Smithore: state.store.smithoreAvgPrice = avgPrice; break;
      case ResourceType.Crystite: state.store.crystiteAvgPrice = avgPrice; break;
    }
  }

  isComplete(): boolean {
    return this.resourceIndex >= AUCTION_RESOURCE_ORDER.length;
  }

  // ── Getters for tick state (for testing) ──

  getStartPrice(): number { return this.startPrice; }
  getMinTick(): number { return this.minTick; }
  getMaxTick(): number { return this.maxTick; }
  getPlayerTick(index: number): number { return this.playerTicks.get(index) ?? 0; }
  getPlayerInArena(index: number): boolean { return this.playerInArena.get(index) ?? false; }
  getTimerElapsedMs(): number { return this.timerElapsedMs; }
  isTransacting(): boolean { return this.transacting; }

  // ── Helpers ──

  private getPlayerResource(player: any, resource: string): number { return player[resource] ?? 0; }
  private setPlayerResource(player: any, resource: string, value: number): void { player[resource] = value; }
  private getStoreResource(state: GameState, resource: string): number { return (state.store as any)[resource] ?? 0; }
  private setStoreResource(state: GameState, resource: string, value: number): void { (state.store as any)[resource] = value; }
}
