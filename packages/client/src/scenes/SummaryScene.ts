import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS } from "../config.js";
import type { StateSync } from "../network/StateSync.js";

interface PlayerData {
  index: number;
  name: string;
  color: string;
  money: number;
  plotCount: number;
  score: number;
  rank: number;
}

const COL_X = [55, 208, 313, 418, 523] as const;
const WALK_SPEED = 120; // px/sec

export class SummaryScene extends Phaser.Scene {
  private stateSync!: StateSync;
  private players: PlayerData[] = [];
  private sprites: Phaser.GameObjects.Rectangle[] = [];
  private targets: { x: number; y: number }[] = [];
  private walkDone = false;
  private tableDrawn = false;
  private isGameOver = false;
  private winnerIndex = -1;
  private colonyScore = 0;
  private colonyRating = "";

  constructor() {
    super({ key: "SummaryScene" });
  }

  init(): void {
    this.stateSync = this.registry.get("stateSync");
    this.walkDone = false;
    this.tableDrawn = false;
    this.sprites = [];
    this.targets = [];
    this.players = [];
  }

  create(): void {
    // Summary background image (or dark overlay fallback)
    if (this.textures.exists("summary_bg")) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "summary_bg")
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(0);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e, 1.0);
    }

    const state = this.stateSync.getState();
    this.isGameOver = state?.phase === "game_over";
    this.winnerIndex = state?.winnerIndex ?? -1;
    this.colonyScore = state?.colonyScore ?? 0;
    this.colonyRating = (state?.colonyRating ?? "").replace(/_/g, " ").toUpperCase();

    // Collect players, sort by rank (rank 1 first)
    const raw: PlayerData[] = [];
    if (state?.players) {
      state.players.forEach((p: any) => {
        raw.push({
          index: p.index ?? 0,
          name: p.name ?? `Player ${p.index}`,
          color: p.color ?? "red",
          money: p.money ?? 0,
          plotCount: p.plotCount ?? 0,
          score: p.score ?? 0,
          rank: p.rank ?? 0,
        });
      });
    }
    // Sort by rank ascending (rank 1 = best, shown first)
    raw.sort((a, b) => a.rank - b.rank);
    this.players = raw;

    // Start walking footstep sounds
    if (!this.sound.get("sfx_steps_outside")?.isPlaying) {
      this.sound.play("sfx_steps_outside", { loop: true, volume: 0.4 });
    }

    // Phase 1: Create walking sprites
    this.players.forEach((player, idx) => {
      const colorVal = PLAYER_COLORS[player.color] ?? 0xffffff;
      const startX = 650 + 110 * idx;
      const startY = 285;
      const targetX = 55;
      const targetY = 95 + 46 * idx;

      const sprite = this.add.rectangle(startX, startY, 24, 24, colorVal);
      this.sprites.push(sprite);
      this.targets.push({ x: targetX, y: targetY });
    });

    // Skip animation on SPACE or click
    const skipHandler = () => {
      if (!this.walkDone) {
        this.finishWalk();
      }
    };
    this.input.keyboard?.on("keydown-SPACE", skipHandler);
    this.input.on("pointerdown", skipHandler);

    // Listen for phase transitions (non-game-over)
    if (!this.isGameOver) {
      this.stateSync.on("phase_changed", this.onPhaseChanged, this);
    }
  }

  update(_time: number, delta: number): void {
    if (this.walkDone) return;

    const dt = delta / 1000;
    let allArrived = true;

    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i];
      const target = this.targets[i];

      const dx = target.x - sprite.x;
      const dy = target.y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        sprite.setPosition(target.x, target.y);
      } else {
        allArrived = false;
        const step = WALK_SPEED * dt;
        if (step >= dist) {
          sprite.setPosition(target.x, target.y);
        } else {
          const nx = dx / dist;
          const ny = dy / dist;
          sprite.x += nx * step;
          sprite.y += ny * step;
        }
      }
    }

    if (allArrived) {
      this.finishWalk();
      // Stop walking sounds
      this.sound.stopByKey("sfx_steps_outside");
      // Play win/lose sound after walk completes
      if (this.isGameOver) {
        this.sound.stopByKey("theme");
        this.sound.stopByKey("theme_short");
        // Determine if local player won
        const state = this.stateSync.getState();
        let localPlayerIndex = -1;
        if (state?.players) {
          state.players.forEach((p: any) => {
            if (!p.isAI) localPlayerIndex = p.index;
          });
        }
        if (localPlayerIndex === this.winnerIndex) {
          this.sound.play("sfx_win");
        } else {
          this.sound.play("sfx_lose");
        }
      } else {
        this.sound.play("sfx_count");
      }
    }
  }

  private finishWalk(): void {
    if (this.walkDone) return;
    this.walkDone = true;

    // Snap all sprites to targets
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].setPosition(this.targets[i].x, this.targets[i].y);
    }

    this.drawTable();
  }

  private drawTable(): void {
    if (this.tableDrawn) return;
    this.tableDrawn = true;

    // Header — use summary_header image if available
    if (this.isGameOver) {
      if (this.textures.exists("summary_header")) {
        // Native size 102x27 — scale up 2.5x for visibility
        this.add.image(GAME_WIDTH / 2, 20, "summary_header")
          .setOrigin(0.5, 0).setDisplaySize(255, 68);
      }
      this.add
        .text(GAME_WIDTH / 2, 20, "GAME OVER", {
          fontSize: "28px",
          fontFamily: "monospace",
          color: "#e74c3c",
        })
        .setOrigin(0.5, 0);
    } else {
      // Non-game-over summary: show summary_header as round summary decoration
      if (this.textures.exists("summary_header")) {
        this.add.image(GAME_WIDTH / 2, 12, "summary_header")
          .setOrigin(0.5, 0).setDisplaySize(255, 68);
      }
    }

    // Column headers at y=70
    const headers = ["PLAYER", "MONEY", "PLOTS", "ASSETS", "TOTAL"];
    const headerStyle = { fontSize: "14px", fontFamily: "monospace", color: "#95a5a6" };
    headers.forEach((h, i) => {
      const t = this.add.text(COL_X[i], 70, h, headerStyle);
      // Right-align numeric columns (indices 1-4)
      if (i > 0) {
        t.setOrigin(1, 0);
      }
    });

    // Player rows
    this.players.forEach((player, idx) => {
      const rowY = 126 + idx * 41;
      const colorVal = PLAYER_COLORS[player.color] ?? 0xffffff;
      const hexColor = `#${colorVal.toString(16).padStart(6, "0")}`;
      const isWinner = player.index === this.winnerIndex;

      const nameStyle = { fontSize: "16px", fontFamily: "monospace", color: hexColor };
      const numStyle = { fontSize: "16px", fontFamily: "monospace", color: hexColor };

      // Name (left-aligned) with winner highlight
      const displayName = isWinner && this.isGameOver ? `${player.name} ★` : player.name;
      this.add.text(COL_X[0], rowY, displayName, nameStyle);

      // Money (right-aligned)
      this.add.text(COL_X[1], rowY, `$${player.money}`, numStyle).setOrigin(1, 0);

      // Plots (right-aligned)
      this.add.text(COL_X[2], rowY, `${player.plotCount}`, numStyle).setOrigin(1, 0);

      // Assets = score - money - (plotCount * 500)
      const assets = Math.max(0, player.score - player.money - player.plotCount * 500);
      this.add.text(COL_X[3], rowY, `$${assets}`, numStyle).setOrigin(1, 0);

      // Total (right-aligned)
      this.add.text(COL_X[4], rowY, `$${player.score}`, numStyle).setOrigin(1, 0);
    });

    // Colony rating at y=320
    const ratingLine = this.colonyRating
      ? `Colony Rating: ${this.colonyRating}  (${this.colonyScore})`
      : `Colony Score: ${this.colonyScore}`;
    this.add
      .text(GAME_WIDTH / 2, 320, ratingLine, {
        fontSize: "17px",
        fontFamily: "monospace",
        color: "#95a5a6",
      })
      .setOrigin(0.5, 0);

    // Game over extras
    if (this.isGameOver) {
      const winner = this.players.find((p) => p.index === this.winnerIndex);
      if (winner) {
        this.add
          .text(GAME_WIDTH / 2, 360, `${winner.name} is the FIRST FOUNDER!`, {
            fontSize: "22px",
            fontFamily: "monospace",
            color: "#f39c12",
          })
          .setOrigin(0.5, 0);
      }

      const btn = this.add
        .text(GAME_WIDTH / 2, 410, "[ PLAY AGAIN ]", {
          fontSize: "22px",
          fontFamily: "monospace",
          color: "#2ecc71",
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setColor("#5dde95"));
      btn.on("pointerout", () => btn.setColor("#2ecc71"));
      btn.on("pointerdown", () => {
        this.stateSync.off("phase_changed", this.onPhaseChanged, this);
        this.scene.stop();
        this.scene.start("LobbyScene");
      });
    }
  }

  private onPhaseChanged(phase: string): void {
    if (phase !== "summary" && phase !== "game_over") {
      this.stateSync.off("phase_changed", this.onPhaseChanged, this);
      if (this.scene.isActive()) this.scene.stop();
    }
  }
}
