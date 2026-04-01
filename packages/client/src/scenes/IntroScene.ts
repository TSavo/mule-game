import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_HEIGHT,
  TILE_WIDTH,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
  PLAYER_COLORS,
} from "../config.js";
import type { StateSync } from "../network/StateSync.js";

const TOWN_COL = 4;
const TOWN_ROW = 2;

/**
 * IntroScene is launched as an overlay on top of MapScene each round.
 *
 * Round 1: Ship descends from sky onto the town center (2.5s landing animation)
 * Round 2+: Ship takes off briefly (1.5s) as a round transition marker
 *
 * The map is visible behind through the semi-transparent overlay.
 * After the animation completes and the server advances phase, the overlay stops.
 */
export class IntroScene extends Phaser.Scene {
  private stateSync!: StateSync;
  private pendingTransition = false;
  private animationDone = false;

  constructor() {
    super({ key: "IntroScene" });
  }

  init(): void {
    this.stateSync = this.registry.get("stateSync");
  }

  create(): void {
    this.pendingTransition = false;
    this.animationDone = false;

    // Transparent background so MapScene tiles show through
    this.cameras.main.transparent = true;

    // Semi-transparent dark overlay for readability
    const overlay = this.add.graphics().setDepth(0);
    overlay.fillStyle(0x1a1a2e, 0.55);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const state = this.stateSync?.getState();
    const round: number = state?.round ?? 1;

    const townCenterX = MAP_OFFSET_X + TOWN_COL * TILE_WIDTH + TILE_WIDTH / 2;
    const townCenterY = MAP_OFFSET_Y + TOWN_ROW * TILE_HEIGHT + TILE_HEIGHT / 2;

    if (round <= 1) {
      // Round 1: Ship descends from sky onto town center
      this.sound.play("sfx_ship_land");
      this.playShipLanding(townCenterX, townCenterY);
    } else {
      // Round 2+: Ship takes off briefly as round transition
      this.sound.play("sfx_new_game");
      this.playShipTakeoff(townCenterX, townCenterY);
    }

    // Text below the map area
    const textY = MAP_OFFSET_Y + 5 * TILE_HEIGHT + 20;

    if (round <= 1) {
      this.add
        .text(GAME_WIDTH / 2, textY, "WELCOME TO", {
          fontSize: "20px",
          fontFamily: "monospace",
          color: "#d4c5a9",
        })
        .setOrigin(0.5)
        .setDepth(11);
    }

    this.add
      .text(GAME_WIDTH / 2, textY + 30, `ROUND ${round}`, {
        fontSize: "32px",
        fontFamily: "monospace",
        color: "#d4c5a9",
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.add
      .text(GAME_WIDTH / 2, textY + 68, "PLANET IRATA", {
        fontSize: "20px",
        fontFamily: "monospace",
        color: "#7f8c8d",
      })
      .setOrigin(0.5)
      .setDepth(11);

    // Player names with colors at bottom
    if (state?.players) {
      const players: Array<{ name: string; color: string }> = [];
      state.players.forEach((p: any) => {
        players.push({
          name: p.name ?? `Player ${(p.index ?? 0) + 1}`,
          color: p.color ?? "red",
        });
      });

      const totalWidth = players.length * 140;
      const startX = (GAME_WIDTH - totalWidth) / 2 + 70;

      players.forEach((p, i) => {
        const hex = PLAYER_COLORS[p.color] ?? 0xffffff;
        const colorStr = "#" + hex.toString(16).padStart(6, "0");
        this.add
          .text(startX + i * 140, GAME_HEIGHT - 20, p.name, {
            fontSize: "16px",
            fontFamily: "monospace",
            color: colorStr,
          })
          .setOrigin(0.5)
          .setDepth(11);
      });
    }

    // Listen for phase change
    this.stateSync.on("phase_changed", this.onPhaseChanged, this);
  }

  private playShipLanding(cx: number, cy: number): void {
    if (!this.textures.exists("ship")) {
      this.animationDone = true;
      return;
    }

    const ship = this.add.image(cx, -60, "ship").setDepth(10);

    if (this.textures.exists("ship_thrust")) {
      const thrust = this.add
        .image(cx, -60 + ship.height / 2 + 20, "ship_thrust")
        .setDepth(9);
      this.tweens.add({
        targets: thrust,
        y: cy + ship.height / 2 + 20,
        duration: 2500,
        ease: "Quad.easeOut",
        onComplete: () => thrust.destroy(),
      });
    }

    this.tweens.add({
      targets: ship,
      y: cy,
      duration: 2500,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.animationDone = true;
      },
    });
  }

  private playShipTakeoff(cx: number, cy: number): void {
    if (!this.textures.exists("ship")) {
      this.animationDone = true;
      return;
    }

    const ship = this.add.image(cx, cy, "ship").setDepth(10);

    if (this.textures.exists("ship_thrust")) {
      const thrust = this.add
        .image(cx, cy + ship.height / 2 + 20, "ship_thrust")
        .setDepth(9);
      this.tweens.add({
        targets: thrust,
        y: -60,
        duration: 1500,
        ease: "Quad.easeIn",
        onComplete: () => thrust.destroy(),
      });
    }

    this.tweens.add({
      targets: ship,
      y: -60,
      duration: 1500,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.animationDone = true;
      },
    });
  }

  update(): void {
    this.stateSync?.poll();

    // Transition when both animation is done and server has advanced phase
    if (this.pendingTransition && this.animationDone) {
      this.pendingTransition = false;
      this.scene.stop("IntroScene");
    }
  }

  private onPhaseChanged(phase: string, _prevPhase: string): void {
    if (phase !== "intro") {
      this.pendingTransition = true;
    }
  }

  shutdown(): void {
    this.stateSync?.off("phase_changed", this.onPhaseChanged, this);
  }
}
