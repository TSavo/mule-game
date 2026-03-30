import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config.js";
import { GameClient } from "../network/GameClient.js";
import { StateSync } from "../network/StateSync.js";

export class LobbyScene extends Phaser.Scene {
  private gameClient!: GameClient;
  private pendingTransition = false;
  private statusText!: Phaser.GameObjects.Text;

  constructor() { super({ key: "LobbyScene" }); }

  create(): void {
    this.gameClient = new GameClient();
    this.pendingTransition = false;

    // Start theme music if not already playing
    if (!this.sound.get("theme")?.isPlaying) {
      this.sound.play("theme", { loop: true, volume: 0.3 });
    }

    // Full-screen background — prefer login_bg, fall back to splash
    if (this.textures.exists("login_bg")) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "login_bg")
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(0);
    } else if (this.textures.exists("splash")) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "splash")
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(0);
    }

    this.add.text(GAME_WIDTH / 2, 60, "Web M.U.L.E.", {
      fontSize: "52px", fontFamily: "monospace", color: "#f39c12",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1);

    this.add.text(GAME_WIDTH / 2, 120, "A Colony on Planet Irata", {
      fontSize: "18px", fontFamily: "monospace", color: "#7f8c8d",
    }).setOrigin(0.5).setDepth(1);

    const createBtn = this.add.text(GAME_WIDTH / 2, 260, "[ CREATE GAME ]", {
      fontSize: "24px", fontFamily: "monospace", color: "#2ecc71",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    createBtn.on("pointerover", () => createBtn.setColor("#27ae60"));
    createBtn.on("pointerout", () => createBtn.setColor("#2ecc71"));
    createBtn.on("pointerdown", () => {
      this.sound.play("sfx_button");
      this.connectAndStart(false);
    });

    const quickBtn = this.add.text(GAME_WIDTH / 2, 320, "[ QUICK PLAY - Solo vs 3 AI ]", {
      fontSize: "20px", fontFamily: "monospace", color: "#3498db",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    quickBtn.on("pointerover", () => quickBtn.setColor("#2980b9"));
    quickBtn.on("pointerout", () => quickBtn.setColor("#3498db"));
    quickBtn.on("pointerdown", () => {
      this.sound.play("sfx_button");
      this.connectAndStart(true);
    });

    this.statusText = this.add.text(GAME_WIDTH / 2, 380, "", {
      fontSize: "16px", fontFamily: "monospace", color: "#e74c3c",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 420, "Standard Mode  |  12 Rounds  |  4 Players", {
      fontSize: "14px", fontFamily: "monospace", color: "#95a5a6",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Inspired by M.U.L.E. (1983) by Danielle Bunten Berry", {
      fontSize: "12px", fontFamily: "monospace", color: "#555",
    }).setOrigin(0.5);
  }

  update(): void {
    // Scene transition from update loop — works reliably unlike async callbacks
    if (this.pendingTransition) {
      this.pendingTransition = false;
      this.scene.start("IntroScene");
    }
  }

  private connectAndStart(quickPlay: boolean): void {
    this.statusText.setText("Connecting...");
    this.gameClient.createGame({ mode: "standard", name: "Player 1", species: "humanoid" })
      .then((room) => {
        this.sound.play("sfx_new_game");
        const stateSync = new StateSync(room);
        if (quickPlay) this.gameClient.startGame();
        this.registry.set("gameClient", this.gameClient);
        this.registry.set("stateSync", stateSync);
        this.registry.set("room", room);
        // Flag for update() to pick up
        this.pendingTransition = true;
      })
      .catch((err) => {
        this.statusText.setText("Error: " + err.message);
        console.error("Failed to connect:", err);
      });
  }
}
