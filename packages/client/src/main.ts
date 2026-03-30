import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BootScene } from "./scenes/BootScene.js";
import { LobbyScene } from "./scenes/LobbyScene.js";
import { IntroScene } from "./scenes/IntroScene.js";
import { MapScene } from "./scenes/MapScene.js";
import { AuctionScene } from "./scenes/AuctionScene.js";
import { CollectionScene } from "./scenes/CollectionScene.js";
import { SummaryScene } from "./scenes/SummaryScene.js";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: "#1a1a2e",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, LobbyScene, IntroScene, MapScene, AuctionScene, CollectionScene, SummaryScene],
};

const game = new Phaser.Game(config);

// Expose for debugging/testing
(window as any).__game = game;

// ── Error logging ─────────────────────────────────────────────────────────
const errors: string[] = [];
(window as any).__errors = errors;

function logError(msg: string) {
  errors.push(`[${new Date().toISOString().slice(11,19)}] ${msg}`);
  console.error("[MULE]", msg);
  // Show on-screen error overlay
  let overlay = document.getElementById("mule-error-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mule-error-overlay";
    overlay.style.cssText = "position:fixed;bottom:0;left:0;right:0;max-height:200px;overflow:auto;background:rgba(0,0,0,0.9);color:#e74c3c;font:12px monospace;padding:8px;z-index:9999;pointer-events:none;";
    document.body.appendChild(overlay);
  }
  overlay.textContent = errors.slice(-10).join("\n");
}

window.addEventListener("error", (e) => logError(`${e.message} @ ${e.filename?.split("/").pop()}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) => logError(`Rejection: ${(e.reason as Error)?.message ?? e.reason}`));
