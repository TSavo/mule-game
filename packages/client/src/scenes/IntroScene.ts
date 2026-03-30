import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS } from "../config.js";
import type { StateSync } from "../network/StateSync.js";

export class IntroScene extends Phaser.Scene {
  private stateSync!: StateSync;
  private pendingTransition = false;

  constructor() {
    super({ key: "IntroScene" });
  }

  init(): void {
    this.stateSync = this.registry.get("stateSync");
  }

  create(): void {
    this.pendingTransition = false;
    this.cameras.main.setBackgroundColor("#1a1a2e");

    const state = this.stateSync?.getState();
    const round: number = state?.round ?? 1;

    // Play intro sound
    if (round <= 1) {
      this.sound.play("sfx_ship_land");
    } else {
      this.sound.play("sfx_new_game");
    }

    // Ship landing animation
    if (this.textures.exists("ship")) {
      const ship = this.add.image(GAME_WIDTH / 2, -60, "ship").setDepth(10);
      if (this.textures.exists("ship_thrust")) {
        const thrust = this.add.image(GAME_WIDTH / 2, -60 + ship.height / 2 + 20, "ship_thrust")
          .setDepth(9);
        // Animate thrust following ship
        this.tweens.add({
          targets: thrust,
          y: GAME_HEIGHT / 2 - 80 + ship.height / 2 + 20,
          duration: 2000,
          ease: "Quad.easeOut",
          onComplete: () => { thrust.destroy(); },
        });
      }
      this.tweens.add({
        targets: ship,
        y: GAME_HEIGHT / 2 - 80,
        duration: 2000,
        ease: "Quad.easeOut",
      });
    }

    // "WELCOME TO" on first round
    if (round <= 1) {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, "WELCOME TO", {
          fontSize: "20px",
          fontFamily: "monospace",
          color: "#d4c5a9",
        })
        .setOrigin(0.5);
    }

    // "ROUND N" large centered
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, `ROUND ${round}`, {
        fontSize: "32px",
        fontFamily: "monospace",
        color: "#d4c5a9",
      })
      .setOrigin(0.5);

    // "PLANET IRATA" subtitle
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15, "PLANET IRATA", {
        fontSize: "20px",
        fontFamily: "monospace",
        color: "#7f8c8d",
      })
      .setOrigin(0.5);

    // Player names with colors at bottom
    if (state?.players) {
      const players: Array<{ name: string; color: string }> = [];
      state.players.forEach((p: any) => {
        players.push({
          name: p.name ?? `Player ${p.index + 1}`,
          color: p.color ?? "red",
        });
      });

      const totalWidth = players.length * 140;
      const startX = (GAME_WIDTH - totalWidth) / 2 + 70;

      players.forEach((p, i) => {
        const hex = PLAYER_COLORS[p.color] ?? 0xffffff;
        const colorStr = "#" + hex.toString(16).padStart(6, "0");
        this.add
          .text(startX + i * 140, GAME_HEIGHT - 60, p.name, {
            fontSize: "16px",
            fontFamily: "monospace",
            color: colorStr,
          })
          .setOrigin(0.5);
      });
    }

    // Listen for phase change to transition to MapScene
    this.stateSync.on("phase_changed", this.onPhaseChanged, this);
  }

  update(): void {
    this.stateSync?.poll();

    if (this.pendingTransition) {
      this.pendingTransition = false;
      // If launched as overlay from MapScene, just stop self.
      // If primary scene (initial load from LobbyScene), start MapScene.
      if (this.scene.isActive("MapScene")) {
        this.scene.stop("IntroScene");
      } else {
        this.scene.start("MapScene");
      }
    }
  }

  private onPhaseChanged(phase: string, _prevPhase: string): void {
    // Any phase change away from intro triggers transition
    if (phase !== "intro") {
      this.pendingTransition = true;
    }
  }

  shutdown(): void {
    this.stateSync?.off("phase_changed", this.onPhaseChanged, this);
  }
}
