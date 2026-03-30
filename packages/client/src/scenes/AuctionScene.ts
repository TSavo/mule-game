import Phaser from "phaser";
import {
  GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS, RESOURCE_COLORS,
} from "../config.js";
import {
  AUCTION_TICK_SCALE,
  getAuctionPriceStep,
  ResourceType,
} from "@mule-game/shared";
import type { GameClient } from "../network/GameClient.js";
import type { StateSync } from "../network/StateSync.js";

// ── Layout constants ────────────────────────────────────────────────────────
const BAR_LEFT = 200;
const BAR_RIGHT = 760;
const BAR_TOP = 60;
const BAR_BOTTOM = 480;
const BAR_MID_Y = (BAR_TOP + BAR_BOTTOM) / 2; // 270
const PIXEL_RATIO = 2; // each tick = 2px vertical movement

const MARKER_W = 30;
const MARKER_H = 16;

const PRICE_LABEL_X = BAR_LEFT - 10; // right-aligned price scale on left

// ── Tick / price helpers ────────────────────────────────────────────────────

/** Map a tick value to a Y pixel coordinate. tick 0 = BAR_MID_Y; positive = up. */
function tickToY(tick: number): number {
  return BAR_MID_Y - tick * PIXEL_RATIO;
}

/** Convert a price to its tick value given the auction floor (startPrice = storeBuyPrice). */
function priceToTick(price: number, startPrice: number, resource: ResourceType): number {
  const step = getAuctionPriceStep(resource);
  if (step === 0) return 0;
  return Math.round(((price - startPrice) / step) * AUCTION_TICK_SCALE);
}

function colorToHex(c: number): string {
  return "#" + c.toString(16).padStart(6, "0");
}

// ── Scene ───────────────────────────────────────────────────────────────────

export class AuctionScene extends Phaser.Scene {
  private gameClient!: GameClient;
  private stateSync!: StateSync;

  // Dynamic graphics layers
  private storeGraphics!: Phaser.GameObjects.Graphics;
  private playerGraphics!: Phaser.GameObjects.Graphics;
  private tradeFlashGraphics!: Phaser.GameObjects.Graphics;

  // Decorative images for store price lines
  private storeBuyLineImage!: Phaser.GameObjects.Image;
  private storeSellLineImage!: Phaser.GameObjects.Image;
  private tradeContactLineImage!: Phaser.GameObjects.Image;

  // Resource header image (auction4 headers)
  private headerImage!: Phaser.GameObjects.Image;
  private currentHeaderKey = "";

  // Text objects updated each frame
  private titleText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private storeBuyLabel!: Phaser.GameObjects.Text;
  private storeSellLabel!: Phaser.GameObjects.Text;
  private noStockLabel!: Phaser.GameObjects.Text;

  // Price scale labels (reused pool)
  private priceLabels: Phaser.GameObjects.Text[] = [];

  // Player marker containers: playerIndex -> container
  private playerMarkers = new Map<number, Phaser.GameObjects.Container>();

  // Trade flash state
  private tradeFlashTimer = 0;
  private tradeFlashY = 0;
  private prevUnitsTraded = 0;

  constructor() {
    super({ key: "AuctionScene" });
  }

  init(): void {
    this.gameClient = this.registry.get("gameClient");
    this.stateSync = this.registry.get("stateSync");
  }

  create(): void {
    this.prevUnitsTraded = 0;
    this.tradeFlashTimer = 0;

    // Auction background image (or dark overlay fallback)
    if (this.textures.exists("auction_bg")) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "auction_bg")
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(0);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e, 1.0);
    }

    // Auction signs decoration — centered above the auction area
    if (this.textures.exists("auction_signs")) {
      this.add.image(GAME_WIDTH / 2, 22, "auction_signs").setOrigin(0.5, 0).setDepth(1);
    }

    // Resource header image (swapped per resource in update())
    this.headerImage = this.add.image(GAME_WIDTH / 2, 6, "__WHITE")
      .setOrigin(0.5, 0).setVisible(false).setDepth(2);

    // Title — colored by resource, updated in update()
    this.titleText = this.add.text(GAME_WIDTH / 2, 20, "AUCTION", {
      fontSize: "24px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(0.5, 0).setDepth(2);

    // Timer countdown — top-right
    this.timerText = this.add.text(GAME_WIDTH - 20, 20, "", {
      fontSize: "20px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(1, 0);

    // Vertical bar border
    const border = this.add.graphics();
    border.lineStyle(2, 0x444444, 1);
    border.strokeRect(BAR_LEFT, BAR_TOP, BAR_RIGHT - BAR_LEFT, BAR_BOTTOM - BAR_TOP);

    // Center line (tick 0 reference)
    const centerLine = this.add.graphics();
    centerLine.lineStyle(1, 0x333333, 0.4);
    centerLine.lineBetween(BAR_LEFT, BAR_MID_Y, BAR_RIGHT, BAR_MID_Y);

    // Direction labels
    this.add.text(BAR_LEFT + 4, BAR_TOP + 3, "SELLERS (higher)", {
      fontSize: "10px", fontFamily: "monospace", color: "#e74c3c",
    });
    this.add.text(BAR_LEFT + 4, BAR_BOTTOM - 14, "BUYERS (lower)", {
      fontSize: "10px", fontFamily: "monospace", color: "#2ecc71",
    });

    // Price scale label pool
    for (let i = 0; i < 24; i++) {
      const t = this.add.text(PRICE_LABEL_X, 0, "", {
        fontSize: "9px", fontFamily: "monospace", color: "#666666",
      }).setOrigin(1, 0.5).setVisible(false);
      this.priceLabels.push(t);
    }

    // Store line labels
    this.storeBuyLabel = this.add.text(BAR_RIGHT + 4, 0, "", {
      fontSize: "10px", fontFamily: "monospace", color: "#2ecc71",
    }).setOrigin(0, 0.5).setVisible(false);

    this.storeSellLabel = this.add.text(BAR_RIGHT + 4, 0, "", {
      fontSize: "10px", fontFamily: "monospace", color: "#e74c3c",
    }).setOrigin(0, 0.5).setVisible(false);

    this.noStockLabel = this.add.text(BAR_RIGHT + 4, BAR_TOP + 10, "NO STORE STOCK", {
      fontSize: "10px", fontFamily: "monospace", color: "#e74c3c",
    }).setVisible(false);

    // Graphics layers
    this.storeGraphics = this.add.graphics();
    this.playerGraphics = this.add.graphics();
    this.tradeFlashGraphics = this.add.graphics();

    // Store price line images (stretched to bar width, positioned in update())
    const barWidth = BAR_RIGHT - BAR_LEFT;
    const barCenterX = (BAR_LEFT + BAR_RIGHT) / 2;

    this.storeBuyLineImage = this.add.image(barCenterX, 0, "auction_line_dashed")
      .setOrigin(0.5, 0.5).setDisplaySize(barWidth, 4).setVisible(false).setAlpha(0.7);
    this.storeSellLineImage = this.add.image(barCenterX, 0, "auction_line_dashed")
      .setOrigin(0.5, 0.5).setDisplaySize(barWidth, 4).setVisible(false).setAlpha(0.7);
    this.tradeContactLineImage = this.add.image(barCenterX, 0, "auction_line_solid")
      .setOrigin(0.5, 0.5).setDisplaySize(barWidth, 4).setVisible(false).setAlpha(0.8);

    // Instruction text
    this.instructionText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20,
      "UP = move higher (sell)  |  DOWN = move lower (buy)", {
        fontSize: "14px", fontFamily: "monospace", color: "#aaaaaa",
      }).setOrigin(0.5);

    // ── Keyboard controls ──
    this.input.keyboard?.on("keydown-UP", () => {
      this.gameClient.setAuctionTick(1);
    });
    this.input.keyboard?.on("keydown-DOWN", () => {
      this.gameClient.setAuctionTick(-1);
    });

    // ── Listeners ──
    this.stateSync.on("phase_changed", this.onPhaseChanged, this);

    // Play auction start sound
    this.sound.play("sfx_count_go");

    // Seed prevUnitsTraded from current state
    const state = this.stateSync.getState();
    if (state?.auction) {
      this.prevUnitsTraded = state.auction.unitsTraded ?? 0;
    }
  }

  // ── Frame update ──────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    const state = this.stateSync.getState();
    if (!state?.auction) return;

    const auction = state.auction;
    const resource: string = auction.resource ?? "";
    const resourceColor: number = RESOURCE_COLORS[resource] ?? 0xffffff;
    const resourceEnum = resource as ResourceType;

    const storeBuyPrice: number = auction.storeBuyPrice ?? 0;
    const storeSellPrice: number = auction.storeSellPrice ?? -1;
    const storeClosed: boolean = auction.storeClosed ?? false;

    // ── Title ──
    // Show resource header image if available (auction4 assets)
    const headerKey = `auction_header_${resource.toLowerCase()}`;
    if (this.textures.exists(headerKey)) {
      if (this.currentHeaderKey !== headerKey) {
        this.headerImage.setTexture(headerKey).setVisible(true);
        // Scale up 2x for visibility (native size is ~34px tall)
        const frame = this.textures.getFrame(headerKey);
        this.headerImage.setDisplaySize(frame.width * 2, frame.height * 2);
        this.currentHeaderKey = headerKey;
      }
      this.titleText.setVisible(false);
    } else {
      this.headerImage.setVisible(false);
      this.titleText.setVisible(true);
      this.titleText.setText(`${resource.toUpperCase()} AUCTION`);
      this.titleText.setColor(colorToHex(resourceColor));
    }

    // ── Timer ──
    const timeRemaining: number = auction.timeRemaining ?? 0;
    const seconds = Math.ceil(timeRemaining / 1000);
    this.timerText.setText(`${seconds}s`);
    this.timerText.setColor(seconds <= 3 ? "#e74c3c" : "#ffffff");

    // Timer ticking during last 3 seconds
    if (seconds > 0 && seconds <= 3) {
      if (!this.sound.get("sfx_timer")?.isPlaying) {
        this.sound.play("sfx_timer", { loop: true, volume: 0.5 });
      }
    } else {
      this.sound.stopByKey("sfx_timer");
    }

    // ── Store price lines ──
    this.storeGraphics.clear();

    // Floor: store buy price (green dashed line image)
    if (storeBuyPrice >= 0) {
      const buyTick = priceToTick(storeBuyPrice, storeBuyPrice, resourceEnum); // = 0
      const buyY = tickToY(buyTick);
      if (buyY >= BAR_TOP && buyY <= BAR_BOTTOM) {
        this.storeBuyLineImage.setVisible(true).setPosition((BAR_LEFT + BAR_RIGHT) / 2, buyY)
          .setTint(0x2ecc71);
        this.storeBuyLabel.setVisible(true).setPosition(BAR_RIGHT + 4, buyY);
        this.storeBuyLabel.setText(`STORE BUYS $${storeBuyPrice}`);
      } else {
        this.storeBuyLineImage.setVisible(false);
        this.storeBuyLabel.setVisible(false);
      }
    } else {
      this.storeBuyLineImage.setVisible(false);
      this.storeBuyLabel.setVisible(false);
    }

    // Ceiling: store sell price (red dashed line image) — removed when no stock
    if (!storeClosed && storeSellPrice > 0) {
      const sellTick = priceToTick(storeSellPrice, storeBuyPrice, resourceEnum);
      const sellY = tickToY(sellTick);
      if (sellY >= BAR_TOP && sellY <= BAR_BOTTOM) {
        this.storeSellLineImage.setVisible(true).setPosition((BAR_LEFT + BAR_RIGHT) / 2, sellY)
          .setTint(0xe74c3c);
        this.storeSellLabel.setVisible(true).setPosition(BAR_RIGHT + 4, sellY);
        this.storeSellLabel.setText(`STORE SELLS $${storeSellPrice}`);
      } else {
        this.storeSellLineImage.setVisible(false);
        this.storeSellLabel.setVisible(false);
      }
      this.noStockLabel.setVisible(false);
    } else {
      this.storeSellLineImage.setVisible(false);
      this.storeSellLabel.setVisible(false);
      this.noStockLabel.setVisible(storeClosed);
    }

    // ── Price scale ──
    this.updatePriceScale(storeBuyPrice, storeSellPrice, resourceEnum);

    // ── Player markers ──
    this.playerGraphics.clear();
    const mySessionId = this.gameClient.getRoom()?.sessionId;
    let myPlayerIndex = -1;

    if (state.players) {
      // Find local player index
      state.players.forEach((p: any) => {
        if (p.sessionId === mySessionId) myPlayerIndex = p.index;
      });

      // Horizontal slot spacing
      const playerCount = state.players.size ?? 4;
      const slotWidth = (BAR_RIGHT - BAR_LEFT) / (playerCount + 1);

      state.players.forEach((p: any) => {
        this.renderPlayerMarker(p, slotWidth, myPlayerIndex);
      });
    }

    // ── Trade flash ──
    const currentUnitsTraded: number = auction.unitsTraded ?? 0;
    if (currentUnitsTraded > this.prevUnitsTraded) {
      const tradePrice: number = auction.lastTradePrice ?? -1;
      if (tradePrice >= 0) {
        const tradeTick = priceToTick(tradePrice, storeBuyPrice, resourceEnum);
        this.tradeFlashY = tickToY(tradeTick);
        this.tradeFlashTimer = 300;
      }
      this.prevUnitsTraded = currentUnitsTraded;
      this.sound.play("sfx_transaction");
    }

    this.tradeFlashGraphics.clear();
    if (this.tradeFlashTimer > 0) {
      this.tradeFlashTimer -= delta;
      const alpha = Math.max(0, this.tradeFlashTimer / 300) * 0.8;
      // Show solid contact line image at trade price
      this.tradeContactLineImage.setVisible(true)
        .setPosition((BAR_LEFT + BAR_RIGHT) / 2, this.tradeFlashY)
        .setTint(0xf1c40f).setAlpha(alpha);
    } else {
      this.tradeContactLineImage.setVisible(false);
    }

    // ── Sub-phase instruction ──
    const subPhase: string = auction.subPhase ?? "idle";
    if (subPhase === "declare") {
      this.instructionText.setText("Waiting for declarations...");
    } else if (subPhase === "trading") {
      this.instructionText.setText("UP = move higher (sell)  |  DOWN = move lower (buy)");
    } else if (subPhase === "transaction") {
      this.instructionText.setText("TRADE IN PROGRESS...");
    }
  }

  // ── Price scale labels ────────────────────────────────────────────────────

  private updatePriceScale(
    storeBuyPrice: number, storeSellPrice: number, resource: ResourceType,
  ): void {
    // Hide all labels first
    for (const label of this.priceLabels) label.setVisible(false);

    const step = getAuctionPriceStep(resource);
    const minPrice = Math.max(0, storeBuyPrice - step * 5);
    const maxPrice = storeSellPrice > 0
      ? storeSellPrice + step * 5
      : storeBuyPrice + step * 20;

    // Choose label interval: show every N price levels
    const totalLevels = (maxPrice - minPrice) / step;
    const interval = totalLevels > 30 ? step * 5 : totalLevels > 15 ? step * 2 : step;

    let idx = 0;
    const startPrice = Math.ceil(minPrice / interval) * interval;
    for (let price = startPrice; price <= maxPrice && idx < this.priceLabels.length; price += interval) {
      const tick = priceToTick(price, storeBuyPrice, resource);
      const y = tickToY(tick);
      if (y >= BAR_TOP + 5 && y <= BAR_BOTTOM - 5) {
        const label = this.priceLabels[idx];
        label.setText(`$${price}`);
        label.setPosition(PRICE_LABEL_X, y);
        label.setVisible(true);
        idx++;
      }
    }
  }

  // ── Player marker ─────────────────────────────────────────────────────────

  private renderPlayerMarker(
    player: any, slotWidth: number, myPlayerIndex: number,
  ): void {
    const role: string = player.auctionRole ?? "none";
    const tick: number = player.auctionTick ?? 0;
    const inArena: boolean = player.auctionInArena ?? false;
    const pIndex: number = player.index ?? 0;

    // Lazily create marker container
    let container = this.playerMarkers.get(pIndex);
    if (!container) {
      const colorVal = PLAYER_COLORS[player.color] ?? 0xffffff;
      const rect = this.add.rectangle(0, 0, MARKER_W, MARKER_H, colorVal);
      const initial = (player.name ?? "?").charAt(0).toUpperCase();
      const label = this.add.text(0, 0, initial, {
        fontSize: "11px", fontFamily: "monospace", color: "#fff",
      }).setOrigin(0.5);
      container = this.add.container(0, 0, [rect, label]);
      this.playerMarkers.set(pIndex, container);
    }

    if (role === "none") {
      container.setVisible(false);
      return;
    }

    container.setVisible(true);

    // Position
    const xPos = BAR_LEFT + slotWidth * (pIndex + 1);
    const yPos = Phaser.Math.Clamp(tickToY(tick), BAR_TOP, BAR_BOTTOM);
    container.setPosition(xPos, yPos);

    // Highlight current player with white border
    if (pIndex === myPlayerIndex) {
      this.playerGraphics.lineStyle(2, 0xffffff, 1);
      this.playerGraphics.strokeRect(
        xPos - MARKER_W / 2 - 2, yPos - MARKER_H / 2 - 2,
        MARKER_W + 4, MARKER_H + 4,
      );
    }

    // Role direction arrow
    if (role === "seller") {
      this.playerGraphics.fillStyle(0xe74c3c, 0.8);
      this.playerGraphics.fillTriangle(
        xPos, yPos - MARKER_H / 2 - 6,
        xPos - 4, yPos - MARKER_H / 2 - 1,
        xPos + 4, yPos - MARKER_H / 2 - 1,
      );
    } else if (role === "buyer") {
      this.playerGraphics.fillStyle(0x2ecc71, 0.8);
      this.playerGraphics.fillTriangle(
        xPos, yPos + MARKER_H / 2 + 6,
        xPos - 4, yPos + MARKER_H / 2 + 1,
        xPos + 4, yPos + MARKER_H / 2 + 1,
      );
    }

    // In-arena dot
    if (inArena) {
      this.playerGraphics.fillStyle(0xffffff, 0.5);
      this.playerGraphics.fillCircle(xPos + MARKER_W / 2 + 4, yPos, 2);
    }
  }

  // ── Phase lifecycle ───────────────────────────────────────────────────────

  private onPhaseChanged(phase: string): void {
    if (phase !== "trading_auction") {
      this.sound.stopByKey("sfx_timer");
      this.sound.play("sfx_auction_bell");
      this.cleanup();
      this.scene.stop();
    }
  }

  private cleanup(): void {
    this.stateSync.off("phase_changed", this.onPhaseChanged, this);
    this.playerMarkers.forEach(c => c.destroy());
    this.playerMarkers.clear();
  }
}
