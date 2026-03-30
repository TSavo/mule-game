import { Room, Client } from "@colyseus/core";
import {
  generateMap,
  SeededRNG,
  STARTING_MONEY,
  STARTING_INVENTORY,
  GameMode,
  MAP_ROWS,
  MAP_COLS,
} from "@mule-game/shared";
import { GameState } from "../state/GameState.js";
import { PlayerSchema } from "../state/PlayerSchema.js";
import { TileSchema } from "../state/TileSchema.js";
import { PhaseManager } from "../phases/PhaseManager.js";
import { LandGrantPhase } from "../phases/LandGrantPhase.js";
import { LandAuctionPhase } from "../phases/LandAuctionPhase.js";
import { DevelopmentPhase } from "../phases/DevelopmentPhase.js";
import { ProductionPhase } from "../phases/ProductionPhase.js";
import { RandomEventPhase } from "../phases/RandomEventPhase.js";
import { TradingAuctionPhase } from "../phases/TradingAuctionPhase.js";
import { ScoringPhase } from "../phases/ScoringPhase.js";
import { EconomyEngine } from "../economy/EconomyEngine.js";
import { AIPlayer } from "../ai/AIPlayer.js";

const COLLECTION_TIMEOUT_MS = 5000;

export class GameRoom extends Room<GameState> {
  private phaseManager = new PhaseManager();
  private landGrantPhase = new LandGrantPhase();
  private landAuctionPhase = new LandAuctionPhase();
  private developmentPhase = new DevelopmentPhase();
  private productionPhase = new ProductionPhase();
  private randomEventPhase = new RandomEventPhase();
  private tradingAuctionPhase = new TradingAuctionPhase();
  private scoringPhase = new ScoringPhase();
  private economyEngine = new EconomyEngine();

  private rng!: SeededRNG;
  private aiPlayers = new Map<number, AIPlayer>();
  private collectionTimer: ReturnType<typeof setTimeout> | null = null;
  private cursorTickAccum = 0;
  private gameStarted = false;
  private activeAuction: TradingAuctionPhase | null = null;

  onCreate(options: {
    mode?: string;
    seed?: number;
    maxPlayers?: number;
  }) {
    this.setState(new GameState());

    const mode = (options.mode as GameMode) ?? GameMode.Standard;
    const seed = options.seed ?? Math.floor(Math.random() * 0xffffffff);

    this.state.mode = mode;
    this.state.seed = seed;
    this.rng = new SeededRNG(seed);

    this.maxClients = options.maxPlayers ?? 4;

    // Build the map
    const gameMap = generateMap(seed);
    for (let r = 0; r < gameMap.tiles.length; r++) {
      for (let c = 0; c < gameMap.tiles[r].length; c++) {
        const mapTile = gameMap.tiles[r][c];
        const ts = new TileSchema();
        ts.row = mapTile.row;
        ts.col = mapTile.col;
        ts.terrain = mapTile.terrain;
        ts.crystiteLevel = mapTile.crystiteLevel;
        ts.owner = mapTile.owner ?? -1;
        ts.installedMule = mapTile.installedMule ?? "";
        this.state.tiles.push(ts);
      }
    }

    this.setPatchRate(50);
    this.registerHandlers();
  }

  private updateCount = 0;
  update(deltaTime: number): void {
    this.updateCount++;
    if (this.updateCount <= 3) console.log(`[UPDATE] #${this.updateCount} dt=${deltaTime} started=${this.gameStarted}`);
    if (!this.gameStarted) return;

    // Land grant cursor advancement (every 500ms)
    if (this.state.phase === "land_grant" && this.state.landGrantActive) {
      this.cursorTickAccum += deltaTime;
      if (this.cursorTickAccum >= 500) {
        this.cursorTickAccum -= 500;
        this.landGrantPhase.advanceCursor(this.state);
        this.runAILandGrantIfNeeded();
        if (!this.state.landGrantActive) {
          this.advancePhase();
        }
      }
    }
  }

  onJoin(client: Client, options: {
    name?: string;
    species?: string;
    color?: string;
    isAI?: boolean;
    aiDifficulty?: string;
  }) {
    const playerIndex = this.state.players.size;
    const player = new PlayerSchema();
    player.index = playerIndex;
    player.name = options.name ?? `Player ${playerIndex + 1}`;
    player.species = options.species ?? "humanoid";
    player.color = options.color ?? "red";
    player.money = STARTING_MONEY[this.state.mode as GameMode] ?? 1000;
    player.food = STARTING_INVENTORY?.food ?? 3;
    player.energy = STARTING_INVENTORY?.energy ?? 0;
    player.smithore = STARTING_INVENTORY?.smithore ?? 0;
    player.crystite = STARTING_INVENTORY?.crystite ?? 0;
    player.isAI = options.isAI ?? false;
    player.aiDifficulty = options.aiDifficulty ?? "";
    player.isReady = false;

    this.state.players.set(String(playerIndex), player);

    if (player.isAI) {
      this.aiPlayers.set(playerIndex, new AIPlayer(playerIndex, player.aiDifficulty || "standard"));
    }

    client.userData = { playerIndex };
  }

  onLeave(client: Client, _consented?: boolean) {
    // Player remains in state; mark as AI-controlled on disconnect if game running
    const idx = client.userData?.playerIndex as number | undefined;
    if (idx !== undefined && this.state.phase !== "waiting" && this.state.phase !== "game_over") {
      const player = this.state.players.get(String(idx));
      if (player && !player.isAI) {
        player.isAI = true;
        player.aiDifficulty = "standard";
        if (!this.aiPlayers.has(idx)) {
          this.aiPlayers.set(idx, new AIPlayer(idx, "standard"));
        }
      }
    }
  }

  onDispose() {
    this.clearCollectionTimer();
  }

  // ── Message Handlers ─────────────────────────────────────────────────────

  private registerHandlers() {
    this.onMessage("start_game", (client) => {
      console.log(`[MSG] start_game received`);
      console.log(`[MSG] gameStarted=${this.gameStarted} players=${this.state.players.size}`);
      if (this.gameStarted) { console.log("[MSG] already started"); return; }
      console.log("[MSG] calling startGame...");
      try {
        this.startGame();
        console.log("[MSG] startGame returned OK");
      } catch (e: any) {
        console.error("[MSG] startGame THREW:", e.message);
        console.error(e.stack);
      }
    });

    this.onMessage("claim_plot", (client, _message) => {
      if (this.state.phase !== "land_grant") return;
      const idx = client.userData?.playerIndex as number;
      this.landGrantPhase.claimPlot(this.state, idx);
      if (this.landGrantPhase.isComplete(this.state)) {
        this.advancePhase();
      }
    });

    this.onMessage("bid", (client, message: { amount: number }) => {
      if (this.state.phase !== "land_auction") return;
      const idx = client.userData?.playerIndex as number;
      this.landAuctionPhase.placeBid(idx, message.amount);
    });

    this.onMessage("buy_mule", (client) => {
      if (this.state.phase !== "development") return;
      const idx = client.userData?.playerIndex as number;
      this.developmentPhase.buyMule(this.state, idx);
    });

    this.onMessage("outfit_mule", (client, message: { resource: string }) => {
      if (this.state.phase !== "development") return;
      const idx = client.userData?.playerIndex as number;
      this.developmentPhase.outfitMule(this.state, idx, message.resource);
    });

    this.onMessage("install_mule", (client, message: { row: number; col: number }) => {
      if (this.state.phase !== "development") return;
      const idx = client.userData?.playerIndex as number;
      const done = this.developmentPhase.installMule(this.state, idx, message.row, message.col);
      if (done) {
        // After installing, end the player's turn
        const complete = this.developmentPhase.endTurn(this.state, this.state.round);
        if (complete) this.advancePhase();
        else this.runAITurnIfNeeded();
      }
    });

    this.onMessage("assay", (client) => {
      if (this.state.phase !== "development") return;
      const idx = client.userData?.playerIndex as number;
      this.developmentPhase.assayOffice(this.state, idx);
    });

    this.onMessage("sell_plot", (client, message: { row: number; col: number }) => {
      if (this.state.phase !== "development") return;
      const idx = client.userData?.playerIndex as number;
      this.developmentPhase.sellPlot(this.state, idx, message.row, message.col);
    });

    this.onMessage("visit_pub", (client) => {
      if (this.state.phase !== "development") return;
      const idx = client.userData?.playerIndex as number;
      console.log(`[PUB] idx=${idx} currentTurn=${this.state.currentPlayerTurn}`);
      this.developmentPhase.visitPub(this.state, idx);
      const complete = this.developmentPhase.endTurn(this.state, this.state.round);
      console.log(`[PUB] endTurn complete=${complete} nextTurn=${this.state.currentPlayerTurn}`);
      if (complete) this.advancePhase();
      else this.runAITurnIfNeeded();
    });

    this.onMessage("end_turn", (client) => {
      if (this.state.phase !== "development") return;
      const idx = client.userData?.playerIndex as number;
      if (this.state.currentPlayerTurn !== idx) return;
      const complete = this.developmentPhase.endTurn(this.state, this.state.round);
      if (complete) this.advancePhase();
      else this.runAITurnIfNeeded();
    });

    this.onMessage("catch_wampus", (client) => {
      if (this.state.phase !== "development" || !this.state.wampusVisible) return;
      const idx = client.userData?.playerIndex as number;
      this.developmentPhase.catchWampus(this.state, idx, this.state.round);
      this.state.wampusVisible = false;
    });

    this.onMessage("declare_auction", (client, message: { role: "buyer" | "seller" }) => {
      if (this.state.phase !== "trading_auction") return;
      const idx = client.userData?.playerIndex as number;
      this.tradingAuctionPhase.declare(this.state, idx, message.role);
    });

    this.onMessage("set_auction_tick", (client, message: { tick: number }) => {
      if (this.state.phase !== "trading_auction") return;
      const idx = client.userData?.playerIndex as number;
      this.tradingAuctionPhase.movePlayer(this.state, idx, message.tick > 0 ? "up" : message.tick < 0 ? "down" : "none");
    });
  }

  // ── Game Flow ─────────────────────────────────────────────────────────────

  private startGame() {
    // Fill remaining slots with AI (tournament mode caps AI at 2)
    const COLORS = ["red", "blue", "green", "purple"] as const;
    const humanCount = this.state.players.size;
    const maxAI = this.state.mode === "tournament" ? 2 : (4 - humanCount);
    let index = this.state.players.size;
    let aiCount = 0;
    while (index < 4 && aiCount < maxAI) {
      const player = new PlayerSchema();
      player.index = index;
      player.name = `AI ${index + 1}`;
      player.species = "humanoid";
      player.color = COLORS[index];
      player.money = STARTING_MONEY[this.state.mode as GameMode] ?? 1000;
      player.food = STARTING_INVENTORY.food;
      player.energy = STARTING_INVENTORY.energy;
      player.isAI = true;
      player.aiDifficulty = "standard";
      this.state.players.set(String(index), player);
      this.aiPlayers.set(index, new AIPlayer(index, "standard"));
      index++;
      aiCount++;
    }

    // Set initial dynamic store prices based on starting supply distribution
    this.economyEngine.updateStorePrices(this.state);

    console.log(`[START] ${this.state.players.size} players, starting game`);
    this.gameStarted = true;
    this.randomEventPhase.generateColonyEventDeck(this.rng);
    this.phaseManager.startGame(this.state);
    console.log(`[START] phase=${this.state.phase} round=${this.state.round}`);
    this.enterPhase();
    console.log(`[START] enterPhase done`);

    // Master game loop — one setInterval drives ALL timed phases
    const self = this;
    let auctionAccum = 0;
    const gameLoop = setInterval(function() {
      try {
        const phase = self.state.phase;

        // Land grant cursor (every 500ms)
        if (phase === "land_grant" && self.state.landGrantActive) {
          self.cursorTickAccum += 50;
          if (self.cursorTickAccum >= 500) {
            self.cursorTickAccum -= 500;
            self.landGrantPhase.advanceCursor(self.state);
            self.runAILandGrantIfNeeded();
            if (!self.state.landGrantActive) {
              self.advancePhase();
            }
          }
        }

        // (Auctions now handled synchronously in enterPhase with setTimeout for advance)

        // Collection auto-advance (2s delay)
        if (phase === "collection" && self.collectionTimer === null) {
          self.collectionTimer = setTimeout(function() {
            self.collectionTimer = null;
            self.advancePhase();
          }, 2000) as any;
        }

        if (phase === "game_over") {
          clearInterval(gameLoop);
        }
      } catch (e: any) {
        console.error("[LOOP ERROR]", e.message);
      }
    }, 50);
  }

  private advancePhase() {
    this.clearCollectionTimer();
    const prev = this.state.phase;
    this.phaseManager.advancePhase(this.state);
    console.log(`[PHASE] ${prev} → ${this.state.phase} (round ${this.state.round})`);
    this.enterPhase();
  }

  private enterPhase() {
    const phase = this.state.phase;
    const round = this.state.round;

    switch (phase) {
      case "intro": {
        // Brief intro display, then advance to land grant
        setTimeout(() => this.advancePhase(), 3000);
        break;
      }

      case "land_grant": {
        this.landGrantPhase.start(this.state);
        this.cursorTickAccum = 0;
        break;
      }

      case "land_auction": {
        this.landAuctionPhase.start(this.state, this.rng);
        if (this.landAuctionPhase.isComplete()) {
          this.advancePhase();
          return;
        }
        this.runLandAuction();
        break;
      }

      case "player_event": {
        this.randomEventPhase.execute(this.state, this.rng, round);
        this.advancePhase();
        break;
      }

      case "colony_event_a": {
        this.randomEventPhase.drawColonyEvent(this.state);
        this.advancePhase();
        break;
      }

      case "development": {
        this.developmentPhase.start(this.state, round);
        this.scheduleWampus();
        this.runAITurnIfNeeded();
        break;
      }

      case "production": {
        this.productionPhase.execute(this.state, round, this.rng);
        this.advancePhase();
        break;
      }

      case "colony_event_b": {
        this.randomEventPhase.drawColonyEvent(this.state);
        this.advancePhase();
        break;
      }

      case "collection": {
        // Recalculate store prices before each auction (Java: Shop.calcBuySellPrice)
        this.economyEngine.updateStorePrices(this.state);
        // Master loop handles the 2s delay via collectionTimer
        break;
      }

      case "trading_auction": {
        const resource = this.phaseManager.getCurrentAuctionResource();
        if (!resource) { this.advancePhase(); return; }

        // Check if anyone has this resource or the store does
        let hasSeller = false;
        const storeHas = (this.state.store as any)[resource] > 0;
        this.state.players.forEach((p: any) => { if ((p as any)[resource] > 0) hasSeller = true; });
        if (!hasSeller && !storeHas) {
          console.log(`[AUCTION] Skipping ${resource} — no sellers`);
          this.advancePhase();
          return;
        }

        console.log(`[AUCTION] Starting ${resource} auction`);
        // Direct AI trading: sellers sell to store, buyers buy from store
        // (Full tick-based auction is for human players via client UI)
        const aPhase = new TradingAuctionPhase();
        aPhase.start(this.state);

        this.state.players.forEach((player: any) => {
          if (!player.isAI) return;
          const ai = this.aiPlayers.get(player.index);
          if (!ai) return;
          const role = ai.decideAuctionRole(this.state, this.rng);
          const amount = (player as any)[resource] ?? 0;
          if (role === "seller" && amount > 0) {
            aPhase.sellToStore(this.state, player.index);
          } else if (role === "buyer") {
            aPhase.buyFromStore(this.state, player.index);
          }
        });

        console.log(`[AUCTION] ${resource} done`);
        this.activeAuction = null;
        // Brief delay before next phase so client can see the result
        const selfAuc = this;
        setTimeout(function() { selfAuc.advancePhase(); }, 500);
        break;
      }

      case "summary": {
        this.scoringPhase.execute(this.state);
        console.log(`[SUMMARY] colony=${this.state.colonyScore} rating=${this.state.colonyRating} winner=P${this.state.winnerIndex}`);
        if (this.state.phase !== "game_over") {
          const selfS = this;
          setTimeout(function() { selfS.advancePhase(); }, 3000);
        }
        break;
      }

      case "game_over":
        // Terminal state — nothing to do
        break;

      default:
        break;
    }
  }

  // ── Wampus helpers ───────────────────────────────────────────────────────

  private wampusTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleWampus() {
    this.state.wampusVisible = false;
    if (this.wampusTimer) clearTimeout(this.wampusTimer);
    // Wampus appears at a random time during development (5-30s in)
    const delay = 5000 + Math.floor(this.rng.next() * 25000);
    this.wampusTimer = setTimeout(() => {
      if (this.state.phase !== "development") return;
      // Pick random map position
      this.state.wampusRow = Math.floor(this.rng.next() * 5);
      this.state.wampusCol = Math.floor(this.rng.next() * 9);
      this.state.wampusVisible = true;
      // Wampus disappears after 750ms
      setTimeout(() => { this.state.wampusVisible = false; }, 750);
    }, delay);
  }

  // ── Land Auction helpers ──────────────────────────────────────────────────

  private runLandAuction() {
    const plot = this.landAuctionPhase.getCurrentPlot();
    if (!plot) { this.advancePhase(); return; }

    // AI players bid on the current plot
    this.state.players.forEach((player: PlayerSchema) => {
      if (!player.isAI) return;
      const ai = this.aiPlayers.get(player.index);
      if (!ai || player.money < 100) return;
      // AI bids between 100 and 200 based on terrain value
      const tile = this.state.tiles.find((t: any) => t.row === plot.row && t.col === plot.col);
      if (!tile) return;
      const terrainBonus = tile.terrain === "mountain3" ? 60 : tile.terrain === "mountain2" ? 40 : tile.terrain === "river" ? 30 : 0;
      const bid = Math.min(player.money, 100 + terrainBonus + Math.floor(this.rng.next() * 50));
      this.landAuctionPhase.placeBid(player.index, bid);
    });

    // Resolve after a short delay (simulates auction timer)
    setTimeout(() => {
      this.landAuctionPhase.resolveCurrentPlot(this.state, this.rng, this.state.round);
      if (this.landAuctionPhase.hasMorePlots()) {
        this.runLandAuction();
      } else {
        this.advancePhase();
      }
    }, 2000);
  }

  // ── Development AI helpers ────────────────────────────────────────────────

  private runAITurnIfNeeded() {
    const currentIdx = this.state.currentPlayerTurn;
    if (currentIdx < 0) return;
    const player = this.state.players.get(String(currentIdx));
    if (!player?.isAI) return;

    const ai = this.aiPlayers.get(currentIdx);
    if (!ai) return;

    const actions = ai.decideDevelopment(this.state, this.rng, this.state.round);
    for (const action of actions) {
      switch (action.type) {
        case "buy_mule":
          this.developmentPhase.buyMule(this.state, currentIdx);
          break;
        case "outfit_mule":
          if (action.resource) this.developmentPhase.outfitMule(this.state, currentIdx, action.resource);
          break;
        case "install_mule":
          if (action.row !== undefined && action.col !== undefined) {
            this.developmentPhase.installMule(this.state, currentIdx, action.row, action.col);
          }
          break;
        case "visit_pub":
          this.developmentPhase.visitPub(this.state, currentIdx);
          break;
      }
    }

    const complete = this.developmentPhase.endTurn(this.state, this.state.round);
    if (complete) {
      this.advancePhase();
    } else {
      this.runAITurnIfNeeded();
    }
  }

  // ── Land Grant AI helpers ────────────────────────────────────────────────

  private runAILandGrantIfNeeded() {
    const curRow = this.state.landGrantCursorRow;
    const curCol = this.state.landGrantCursorCol;
    this.state.players.forEach((player: PlayerSchema) => {
      if (!player.isAI) return;
      const ai = this.aiPlayers.get(player.index);
      if (!ai) return;
      const choice = ai.decideLandGrant(this.state, this.rng);
      // AI only claims if cursor is at or near their desired tile
      if (choice && choice.row === curRow && choice.col === curCol) {
        this.landGrantPhase.claimPlot(this.state, player.index);
      }
    });
  }

  // ── Auction AI helpers ────────────────────────────────────────────────────

  private runAIAuctionDecisions() {
    this.state.players.forEach((player: PlayerSchema) => {
      if (!player.isAI) return;
      const ai = this.aiPlayers.get(player.index);
      if (!ai) return;
      const role = ai.decideAuctionRole(this.state, this.rng);
      this.tradingAuctionPhase.declare(this.state, player.index, role);
      // AI sets their tick after declaring
      setTimeout(() => {
        const tick = ai.decideAuctionTick(this.state, this.rng, role);
        const current = this.tradingAuctionPhase.getPlayerTick(player.index);
        const diff = tick - current;
        const direction = diff > 0 ? "up" : diff < 0 ? "down" : "none";
        for (let i = 0; i < Math.abs(diff); i++) {
          this.tradingAuctionPhase.movePlayer(this.state, player.index, direction);
        }
      }, 500 + Math.floor(Math.random() * 1000));
    });
  }

  private runAuctionLoop() {
    const TICK_INTERVAL = 100; // ms

    const interval = setInterval(() => {
      const done = this.tradingAuctionPhase.updateTimer(this.state, TICK_INTERVAL);
      this.tradingAuctionPhase.updateBuySellTicks(this.state);
      const trade = this.tradingAuctionPhase.checkForTrades(this.state);
      if (trade) {
        this.tradingAuctionPhase.executeTrade(
          this.state,
          trade.seller,
          trade.buyer,
          this.phaseManager.getCurrentAuctionResource(),
          trade.price,
        );
      }

      if (done || this.tradingAuctionPhase.isComplete()) {
        clearInterval(interval);
        this.advancePhase();
      }
    }, TICK_INTERVAL);
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  private clearCollectionTimer() {
    if (this.collectionTimer !== null) {
      clearTimeout(this.collectionTimer);
      this.collectionTimer = null;
    }
  }
}
