import Phaser from "phaser";
import { TILE_WIDTH, TILE_HEIGHT, MAP_OFFSET_X, MAP_OFFSET_Y, PLAYER_COLORS } from "../config.js";

/** Maps terrain types to the base tile texture key loaded in BootScene */
const TERRAIN_TILE_MAP: Record<string, string> = {
  plains: "tile_plain",
  river: "tile_river",
  small_water: "tile_plain",
  mountain1: "tile_crater",
  mountain2: "tile_crater",
  mountain3: "tile_crater",
  town: "tile_shop",
};

/** Maps terrain types to an optional decal overlay texture key */
const TERRAIN_DECAL_MAP: Record<string, string> = {
  river: "decal_water",
  small_water: "decal_small_water",
  mountain1: "decal_mountains",
  mountain2: "decal_mountains",
  mountain3: "decal_mountains",
};

/** Maps resource type to factory spritesheet frame index (first row of 4x4 grid) */
const FACTORY_FRAME_MAP: Record<string, number> = {
  food: 0,
  energy: 1,
  smithore: 2,
  crystite: 3,
};

export class TileRenderer {
  private scene: Phaser.Scene;
  private tileImages = new Map<string, Phaser.GameObjects.Image>();
  private decalImages = new Map<string, Phaser.GameObjects.Image>();
  private ownerOverlays = new Map<string, Phaser.GameObjects.Image>();
  private ownerOverlayGraphics = new Map<string, Phaser.GameObjects.Graphics>();
  private factorySprites = new Map<string, Phaser.GameObjects.Image>();
  private muleIcons = new Map<string, Phaser.GameObjects.Text>();
  private productionBits = new Map<string, Phaser.GameObjects.Image[]>();
  private highlightImages = new Map<string, Phaser.GameObjects.Image>();
  private crystiteIndicators = new Map<string, Phaser.GameObjects.Graphics>();
  private smithoreIndicators = new Map<string, Phaser.GameObjects.Graphics>();
  private wampusImage?: Phaser.GameObjects.Image;
  private wampusBlinkTimer?: Phaser.Time.TimerEvent;
  private cursorImage?: Phaser.GameObjects.Image;
  private cursorPhase: "land_grant" | "land_auction" | "other" = "other";
  private claimEffects: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  getTilePosition(row: number, col: number): { x: number; y: number } {
    return { x: MAP_OFFSET_X + col * TILE_WIDTH + TILE_WIDTH / 2, y: MAP_OFFSET_Y + row * TILE_HEIGHT + TILE_HEIGHT / 2 };
  }

  /** Set the current phase so drawCursor can choose the correct frame asset */
  setCursorPhase(phase: string): void {
    if (phase === "land_grant") this.cursorPhase = "land_grant";
    else if (phase === "land_auction") this.cursorPhase = "land_auction";
    else this.cursorPhase = "other";
  }

  renderTile(
    row: number,
    col: number,
    terrain: string,
    owner: number,
    installedMule: string,
    ownerColor: string,
    crystiteLevel?: string,
    crystiteRevealed?: boolean,
    smithoreLevel?: number,
    lastProduction?: number,
    hadEnergy?: boolean,
  ): void {
    const key = `${row},${col}`;
    const { x, y } = this.getTilePosition(row, col);

    // --- Base tile image ---
    const tileTexture = TERRAIN_TILE_MAP[terrain] ?? "tile_plain";
    let tileImg = this.tileImages.get(key);
    if (!tileImg) {
      tileImg = this.scene.add.image(x, y, tileTexture)
        .setOrigin(0.5)
        .setDisplaySize(TILE_WIDTH, TILE_HEIGHT)
        .setDepth(0);
      this.tileImages.set(key, tileImg);
    } else {
      tileImg.setTexture(tileTexture).setPosition(x, y).setDisplaySize(TILE_WIDTH, TILE_HEIGHT);
    }

    // --- Decal overlay ---
    const decalTexture = TERRAIN_DECAL_MAP[terrain];
    let decalImg = this.decalImages.get(key);
    if (decalTexture) {
      if (!decalImg) {
        decalImg = this.scene.add.image(x, y, decalTexture)
          .setOrigin(0.5)
          .setDisplaySize(TILE_WIDTH, TILE_HEIGHT)
          .setDepth(1);
        this.decalImages.set(key, decalImg);
      } else {
        decalImg.setTexture(decalTexture).setPosition(x, y).setDisplaySize(TILE_WIDTH, TILE_HEIGHT).setVisible(true);
      }
    } else if (decalImg) {
      decalImg.setVisible(false);
    }

    // --- Crystite level indicator (top-right corner diamond) ---
    let crystG = this.crystiteIndicators.get(key);
    if (!crystG) { crystG = this.scene.add.graphics().setDepth(10); this.crystiteIndicators.set(key, crystG); }
    crystG.clear();
    if (crystiteRevealed && crystiteLevel && crystiteLevel !== "none") {
      const cx = x + TILE_WIDTH / 2 - 8;
      const cy = y - TILE_HEIGHT / 2 + 8;
      let dotSize: number;
      let dotColor: number;
      if (crystiteLevel === "low") {
        dotSize = 2; dotColor = 0x6ab4d9;
      } else if (crystiteLevel === "medium") {
        dotSize = 3; dotColor = 0x3498db;
      } else {
        dotSize = 4; dotColor = 0x00ccff;
      }
      crystG.fillStyle(dotColor, 1);
      crystG.fillTriangle(cx, cy - dotSize, cx + dotSize, cy, cx, cy + dotSize);
      crystG.fillTriangle(cx, cy - dotSize, cx - dotSize, cy, cx, cy + dotSize);
    }

    // --- Smithore quality indicator (bottom-left corner dots for mountain tiles) ---
    let smG = this.smithoreIndicators.get(key);
    if (!smG) { smG = this.scene.add.graphics().setDepth(10); this.smithoreIndicators.set(key, smG); }
    smG.clear();
    if (terrain.startsWith("mountain") && smithoreLevel && smithoreLevel > 0) {
      const dotCount = Math.min(smithoreLevel, 4);
      smG.fillStyle(0x95a5a6, 0.9);
      for (let i = 0; i < dotCount; i++) {
        const dx = x - TILE_WIDTH / 2 + 8 + i * 7;
        const dy = y + TILE_HEIGHT / 2 - 8;
        smG.fillCircle(dx, dy, 2);
      }
    }

    // --- Owner overlay (plot_border image tinted with owner color) ---
    let borderImg = this.ownerOverlays.get(key);
    let borderG = this.ownerOverlayGraphics.get(key);
    if (owner >= 0 && ownerColor) {
      const tintColor = PLAYER_COLORS[ownerColor] ?? 0xffffff;
      const hasPlotBorder = this.scene.textures.exists("plot_border");
      if (hasPlotBorder) {
        // Use plot_border image tinted with owner color
        if (!borderImg) {
          borderImg = this.scene.add.image(x, y, "plot_border")
            .setOrigin(0.5)
            .setDisplaySize(TILE_WIDTH, TILE_HEIGHT)
            .setDepth(20)
            .setAlpha(0.8);
          this.ownerOverlays.set(key, borderImg);
        } else {
          borderImg.setPosition(x, y).setDisplaySize(TILE_WIDTH, TILE_HEIGHT).setVisible(true);
        }
        borderImg.setTint(tintColor);
        // Hide fallback graphics if it exists
        if (borderG) borderG.clear();
      } else {
        // Fallback: colored stroke rectangle
        if (!borderG) { borderG = this.scene.add.graphics().setDepth(20); this.ownerOverlayGraphics.set(key, borderG); }
        borderG.clear();
        borderG.lineStyle(3, tintColor, 0.8);
        borderG.strokeRect(x - TILE_WIDTH / 2 + 1, y - TILE_HEIGHT / 2 + 1, TILE_WIDTH - 2, TILE_HEIGHT - 2);
        if (borderImg) borderImg.setVisible(false);
      }
    } else {
      if (borderImg) borderImg.setVisible(false);
      if (borderG) borderG.clear();
    }

    // --- Factory sprite (installed MULE) ---
    let factoryImg = this.factorySprites.get(key);
    if (installedMule) {
      const frameIndex = FACTORY_FRAME_MAP[installedMule] ?? 0;
      // Use dimmer factory_low_energy spritesheet when tile had insufficient energy
      const energyOk = hadEnergy !== false;
      const hasLowEnergy = this.scene.textures.exists("factory_low_energy");
      const factoryTexture = (!energyOk && hasLowEnergy) ? "factory_low_energy" : "factories";
      const hasTexture = this.scene.textures.exists(factoryTexture);
      if (hasTexture) {
        if (!factoryImg) {
          factoryImg = this.scene.add.image(x, y + 4, factoryTexture, frameIndex)
            .setOrigin(0.5)
            .setDisplaySize(TILE_WIDTH * 0.75, TILE_HEIGHT * 0.45)
            .setDepth(25);
          this.factorySprites.set(key, factoryImg);
        } else {
          factoryImg.setTexture(factoryTexture, frameIndex)
            .setPosition(x, y + 4)
            .setDisplaySize(TILE_WIDTH * 0.75, TILE_HEIGHT * 0.45)
            .setVisible(true);
        }
      }
      // Also keep the letter overlay for clarity at small sizes
      const ch = installedMule === "food" ? "F" : installedMule === "energy" ? "E" : installedMule === "smithore" ? "S" : "C";
      let icon = this.muleIcons.get(key);
      if (!icon) {
        icon = this.scene.add.text(x, y + TILE_HEIGHT / 2 - 10, ch, { fontSize: "11px", fontFamily: "monospace", color: "#fff", backgroundColor: "#00000080", padding: { x: 2, y: 0 } })
          .setOrigin(0.5)
          .setDepth(30);
        this.muleIcons.set(key, icon);
      } else { icon.setText(ch).setPosition(x, y + TILE_HEIGHT / 2 - 10).setVisible(true); }
    } else {
      if (factoryImg) factoryImg.setVisible(false);
      const icon = this.muleIcons.get(key);
      if (icon) icon.setVisible(false);
    }

    // --- Production bit indicators (show output from last production round) ---
    const prevBits = this.productionBits.get(key) ?? [];
    const prodCount = lastProduction ?? 0;
    const hasProductionBit = this.scene.textures.exists("production_bit");
    if (prodCount > 0 && hasProductionBit && installedMule) {
      const bitsToShow = Math.min(prodCount, 6); // cap visual at 6
      for (let i = 0; i < bitsToShow; i++) {
        const bx = x - ((bitsToShow - 1) * 6) / 2 + i * 6;
        const by = y + TILE_HEIGHT / 2 - 2;
        if (i < prevBits.length) {
          prevBits[i].setPosition(bx, by).setVisible(true);
        } else {
          const bit = this.scene.add.image(bx, by, "production_bit")
            .setOrigin(0.5, 1)
            .setDisplaySize(8, 8)
            .setDepth(35);
          prevBits.push(bit);
        }
      }
      // Hide excess bits
      for (let i = bitsToShow; i < prevBits.length; i++) {
        prevBits[i].setVisible(false);
      }
      this.productionBits.set(key, prevBits);
    } else {
      for (const bit of prevBits) bit.setVisible(false);
    }
  }

  /** Show/hide the wampus indicator using the wumpus sprite. Blinks: 1.2s visible, 0.4s hidden. */
  renderWampus(visible: boolean, row: number, col: number): void {
    // Clean up previous timer
    if (this.wampusBlinkTimer) {
      this.wampusBlinkTimer.remove();
      this.wampusBlinkTimer = undefined;
    }
    if (this.wampusImage) {
      this.wampusImage.setVisible(false);
    }

    if (!visible || row < 0 || col < 0) return;

    const pos = this.getTilePosition(row, col);
    if (!this.wampusImage) {
      this.wampusImage = this.scene.add
        .image(pos.x, pos.y, "wumpus")
        .setOrigin(0.5)
        .setDisplaySize(TILE_WIDTH * 0.6, TILE_HEIGHT * 0.6)
        .setDepth(150);
    } else {
      this.wampusImage.setPosition(pos.x, pos.y).setVisible(true);
    }

    // Blink cycle: 1.2s visible, 0.4s hidden (1.6s total period)
    let isVisible = true;
    this.wampusBlinkTimer = this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (!this.wampusImage) return;
        const elapsed = this.scene.time.now % 1600;
        const shouldShow = elapsed < 1200;
        if (shouldShow !== isVisible) {
          isVisible = shouldShow;
          this.wampusImage.setVisible(isVisible);
        }
      },
    });
  }

  drawCursor(row: number, col: number, graphics: Phaser.GameObjects.Graphics): void {
    const { x, y } = this.getTilePosition(row, col);
    graphics.clear();

    // Choose frame asset based on current phase
    const frameKey = this.cursorPhase === "land_grant" ? "land_grant_frame"
      : this.cursorPhase === "land_auction" ? "land_auction_frame"
      : null;

    if (frameKey && this.scene.textures.exists(frameKey)) {
      // Use the sprite frame instead of plain rectangle
      if (!this.cursorImage) {
        this.cursorImage = this.scene.add.image(x, y, frameKey)
          .setOrigin(0.5)
          .setDisplaySize(TILE_WIDTH, TILE_HEIGHT)
          .setDepth(100);
      } else {
        this.cursorImage.setTexture(frameKey)
          .setPosition(x, y)
          .setDisplaySize(TILE_WIDTH, TILE_HEIGHT)
          .setVisible(true);
      }
    } else {
      // Fallback: white stroke rectangle
      if (this.cursorImage) this.cursorImage.setVisible(false);
      graphics.lineStyle(4, 0xffffff, 1);
      graphics.strokeRect(x - TILE_WIDTH / 2, y - TILE_HEIGHT / 2, TILE_WIDTH, TILE_HEIGHT);
    }
  }

  /** Hide the cursor image (called on phase change) */
  clearCursor(): void {
    if (this.cursorImage) this.cursorImage.setVisible(false);
  }

  /** Show factory highlight on a tile (hover effect for owned tiles with MULEs) */
  showFactoryHighlight(row: number, col: number, installedMule: string): void {
    const key = `${row},${col}`;
    const { x, y } = this.getTilePosition(row, col);
    if (!this.scene.textures.exists("factory_highlights")) return;
    let img = this.highlightImages.get(key);
    if (!img) {
      img = this.scene.add.image(x, y, "factory_highlights")
        .setOrigin(0.5)
        .setDisplaySize(TILE_WIDTH, TILE_HEIGHT)
        .setDepth(22)
        .setAlpha(0.5);
      this.highlightImages.set(key, img);
    } else {
      img.setPosition(x, y).setDisplaySize(TILE_WIDTH, TILE_HEIGHT).setVisible(true).setAlpha(0.5);
    }
  }

  /** Hide factory highlight on a tile */
  hideFactoryHighlight(row: number, col: number): void {
    const key = `${row},${col}`;
    const img = this.highlightImages.get(key);
    if (img) img.setVisible(false);
  }

  /** Hide all factory highlights */
  hideAllFactoryHighlights(): void {
    this.highlightImages.forEach((img) => img.setVisible(false));
  }

  /** Flash the claim_effect sprite on a tile when it is claimed */
  playClaim(row: number, col: number): void {
    if (!this.scene.textures.exists("claim_effect")) return;
    const { x, y } = this.getTilePosition(row, col);
    const fx = this.scene.add.image(x, y, "claim_effect")
      .setOrigin(0.5)
      .setDisplaySize(TILE_WIDTH, TILE_HEIGHT)
      .setDepth(110)
      .setAlpha(1);
    this.claimEffects.push(fx);
    this.scene.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 500,
      ease: "Power2",
      onComplete: () => {
        fx.destroy();
        const idx = this.claimEffects.indexOf(fx);
        if (idx >= 0) this.claimEffects.splice(idx, 1);
      },
    });
  }
}
