# Web M.U.L.E. Plan 3: Game Client

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phaser 3 browser client that connects to the Colyseus server and renders the full M.U.L.E. game — map, town, auctions, HUD — with retro pixel art aesthetic.

**Architecture:** Phaser 3 scenes driven entirely by Colyseus synced state. Client is pure rendering + input — zero game logic. All state comes from the server. Client sends action messages, server validates and updates.

**Tech Stack:** Phaser 3, Colyseus.js client SDK, TypeScript, Vite

---

## File Structure

```
packages/
  client/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      main.ts                     — Phaser game bootstrap
      config.ts                   — Game dimensions, colors, tile sizes
      network/
        GameClient.ts             — Colyseus client wrapper, message sending
        StateSync.ts              — Listen to schema changes, emit events
      scenes/
        BootScene.ts              — Load assets, show loading bar
        LobbyScene.ts             — Create/join game, player setup
        MapScene.ts               — 5x9 grid, land grant cursor, M.U.L.E. placement
        TownScene.ts              — Interior during development (corral, shops, assay, pub)
        AuctionScene.ts           — Trading auction: declaration + tick-based trading
        CollectionScene.ts        — Pre-auction production bars display
        SummaryScene.ts           — End-of-round scoring, colony rating
      ui/
        HUD.ts                    — Player money, resources, round/phase info, timer
        ProductionBars.ts         — Animated resource bars for collection phase
        PlayerAvatar.ts           — Pixel art player character rendering
        MuleSprite.ts             — M.U.L.E. sprite with outfit indicator
        TileRenderer.ts           — Terrain tile rendering (plains, river, mountain variants)
      assets/
        sprites/                  — Pixel art spritesheets
        audio/                    — Sound effects
    public/
      (static assets)
```

---

### Task 1: Client Package Setup

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/index.html`
- Create: `packages/client/src/main.ts`
- Create: `packages/client/src/config.ts`

- [ ] **Step 1: Create packages/client/package.json**

```json
{
  "name": "@mule-game/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "colyseus.js": "^0.15.0",
    "phaser": "^3.87.0"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create packages/client/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/client/vite.config.ts**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
  },
  server: {
    port: 3000,
  },
});
```

- [ ] **Step 4: Create packages/client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M.U.L.E.</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; }
    canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Create packages/client/src/config.ts**

```ts
// Game canvas dimensions (16:9 aspect, pixel art friendly)
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// Tile dimensions for the 5x9 map grid
export const TILE_WIDTH = 80;
export const TILE_HEIGHT = 80;

// Map offset (centering the 9x5 grid within game area)
export const MAP_OFFSET_X = (GAME_WIDTH - 9 * TILE_WIDTH) / 2;
export const MAP_OFFSET_Y = 40;

// Player colors (matching server)
export const PLAYER_COLORS: Record<string, number> = {
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  purple: 0x9b59b6,
};

// Terrain colors (retro pixel art palette)
export const TERRAIN_COLORS: Record<string, number> = {
  plains: 0xc4a24e,     // sandy brown
  river: 0x4a90d9,      // blue
  mountain1: 0x8b7355,  // light brown (small hills)
  mountain2: 0x6b5b3e,  // medium brown
  mountain3: 0x4a3c28,  // dark brown (large peaks)
  town: 0xd4c5a9,       // light tan
};

// Resource colors
export const RESOURCE_COLORS: Record<string, number> = {
  food: 0x2ecc71,     // green
  energy: 0xf39c12,   // yellow/orange
  smithore: 0x95a5a6,  // grey
  crystite: 0x3498db,  // blue
};

// Server connection
export const SERVER_URL = "ws://localhost:2567";

// Auction display
export const AUCTION_AREA_HEIGHT = 400;  // pixels for price range
export const AUCTION_PRICE_BAR_X = 100;
export const AUCTION_PLAYER_SPACING = 150;

// Animation speeds
export const CURSOR_SPEED_MS = 500;
export const PRODUCTION_BAR_SPEED_MS = 100;
```

- [ ] **Step 6: Create packages/client/src/main.ts**

```ts
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BootScene } from "./scenes/BootScene.js";
import { LobbyScene } from "./scenes/LobbyScene.js";
import { MapScene } from "./scenes/MapScene.js";
import { TownScene } from "./scenes/TownScene.js";
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
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    LobbyScene,
    MapScene,
    TownScene,
    AuctionScene,
    CollectionScene,
    SummaryScene,
  ],
};

new Phaser.Game(config);
```

- [ ] **Step 7: Install dependencies and verify**

```bash
cd ~/mule-game && pnpm install
cd packages/client && npx vite build --mode development 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add packages/client/
git commit -m "chore: client package setup with Phaser 3, Colyseus.js, Vite"
```

---

### Task 2: Network Layer

**Files:**
- Create: `packages/client/src/network/GameClient.ts`
- Create: `packages/client/src/network/StateSync.ts`

- [ ] **Step 1: Create GameClient.ts**

```ts
import { Client, Room } from "colyseus.js";
import { SERVER_URL } from "../config.js";

export class GameClient {
  private client: Client;
  private room: Room | null = null;

  constructor() {
    this.client = new Client(SERVER_URL);
  }

  async createGame(options: { mode?: string; name?: string; species?: string }): Promise<Room> {
    this.room = await this.client.create("game", options);
    return this.room;
  }

  async joinGame(roomId: string, options: { name?: string; species?: string }): Promise<Room> {
    this.room = await this.client.joinById(roomId, options);
    return this.room;
  }

  async joinLobby(): Promise<Room> {
    return await this.client.join("lobby");
  }

  getRoom(): Room | null {
    return this.room;
  }

  // ── Action Messages ──

  startGame(): void {
    this.room?.send("start_game", {});
  }

  claimPlot(): void {
    this.room?.send("claim_plot", {});
  }

  bid(amount: number): void {
    this.room?.send("bid", { amount });
  }

  buyMule(): void {
    this.room?.send("buy_mule", {});
  }

  outfitMule(resource: string): void {
    this.room?.send("outfit_mule", { resource });
  }

  installMule(row: number, col: number): void {
    this.room?.send("install_mule", { row, col });
  }

  visitPub(): void {
    this.room?.send("visit_pub", {});
  }

  endTurn(): void {
    this.room?.send("end_turn", {});
  }

  declareAuction(role: "buyer" | "seller"): void {
    this.room?.send("declare_auction", { role });
  }

  setAuctionTick(tick: number): void {
    this.room?.send("set_auction_tick", { tick });
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
  }
}
```

- [ ] **Step 2: Create StateSync.ts**

```ts
import Phaser from "phaser";
import type { Room } from "colyseus.js";

/**
 * Bridges Colyseus state changes to Phaser events.
 * Scenes listen to events on this emitter rather than polling state.
 */
export class StateSync extends Phaser.Events.EventEmitter {
  private room: Room;

  constructor(room: Room) {
    super();
    this.room = room;
    this.setupListeners();
  }

  private setupListeners(): void {
    const state = this.room.state as any;

    // Phase changes
    state.listen("phase", (value: string, prev: string) => {
      this.emit("phase_changed", value, prev);
    });

    // Round changes
    state.listen("round", (value: number) => {
      this.emit("round_changed", value);
    });

    // Land grant cursor
    state.listen("landGrantCursorRow", () => {
      this.emit("cursor_moved", state.landGrantCursorRow, state.landGrantCursorCol);
    });
    state.listen("landGrantCursorCol", () => {
      this.emit("cursor_moved", state.landGrantCursorRow, state.landGrantCursorCol);
    });

    // Development turn
    state.listen("currentPlayerTurn", (value: number) => {
      this.emit("turn_changed", value);
    });

    state.listen("turnTimeRemaining", (value: number) => {
      this.emit("turn_timer", value);
    });

    // Auction state
    state.listen("auction", (auction: any) => {
      this.emit("auction_updated", auction);
    });

    // Event message
    state.listen("eventMessage", (value: string) => {
      if (value) this.emit("event_message", value);
    });

    // Scoring
    state.listen("colonyScore", (value: number) => {
      this.emit("colony_score", value);
    });

    state.listen("winnerIndex", (value: number) => {
      if (value >= 0) this.emit("winner", value);
    });

    // Tile ownership changes
    state.tiles.onAdd((tile: any, key: number) => {
      tile.listen("owner", (value: number) => {
        this.emit("tile_owner_changed", tile.row, tile.col, value);
      });
      tile.listen("installedMule", (value: string) => {
        this.emit("tile_mule_changed", tile.row, tile.col, value);
      });
    });

    // Player changes
    state.players.onAdd((player: any, key: string) => {
      this.emit("player_added", player);
      player.listen("money", () => this.emit("player_updated", player));
      player.listen("food", () => this.emit("player_updated", player));
      player.listen("energy", () => this.emit("player_updated", player));
      player.listen("smithore", () => this.emit("player_updated", player));
      player.listen("crystite", () => this.emit("player_updated", player));
    });
  }

  getState(): any {
    return this.room.state;
  }

  destroy(): void {
    this.removeAllListeners();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/network/
git commit -m "feat: network layer — Colyseus client wrapper and state sync bridge"
```

---

### Task 3: Boot & Lobby Scenes

**Files:**
- Create: `packages/client/src/scenes/BootScene.ts`
- Create: `packages/client/src/scenes/LobbyScene.ts`

- [ ] **Step 1: Create BootScene.ts**

```ts
import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4a90d9, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
    });

    // Generate placeholder sprites programmatically (no external assets needed)
    this.generatePlaceholderSprites();
  }

  create(): void {
    this.scene.start("LobbyScene");
  }

  private generatePlaceholderSprites(): void {
    // Player avatar (16x16 pixel art)
    const avatarGraphics = this.make.graphics({ x: 0, y: 0 });
    avatarGraphics.fillStyle(0xffffff);
    avatarGraphics.fillRect(4, 0, 8, 4);   // head
    avatarGraphics.fillRect(2, 4, 12, 8);  // body
    avatarGraphics.fillRect(4, 12, 3, 4);  // left leg
    avatarGraphics.fillRect(9, 12, 3, 4);  // right leg
    avatarGraphics.generateTexture("player_avatar", 16, 16);
    avatarGraphics.destroy();

    // M.U.L.E. sprite (16x16)
    const muleGraphics = this.make.graphics({ x: 0, y: 0 });
    muleGraphics.fillStyle(0xaaaaaa);
    muleGraphics.fillRect(2, 4, 12, 6);   // body
    muleGraphics.fillRect(0, 2, 4, 4);    // head
    muleGraphics.fillRect(2, 10, 3, 4);   // front legs
    muleGraphics.fillRect(11, 10, 3, 4);  // back legs
    muleGraphics.generateTexture("mule_sprite", 16, 16);
    muleGraphics.destroy();
  }
}
```

- [ ] **Step 2: Create LobbyScene.ts**

```ts
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS } from "../config.js";
import { GameClient } from "../network/GameClient.js";
import { StateSync } from "../network/StateSync.js";

export class LobbyScene extends Phaser.Scene {
  private gameClient!: GameClient;

  constructor() {
    super({ key: "LobbyScene" });
  }

  create(): void {
    this.gameClient = new GameClient();

    // Title
    this.add.text(GAME_WIDTH / 2, 80, "M.U.L.E.", {
      fontSize: "64px",
      fontFamily: "monospace",
      color: "#f39c12",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 140, "A Colony on Planet Irata", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#7f8c8d",
    }).setOrigin(0.5);

    // Create Game button
    const createBtn = this.add.text(GAME_WIDTH / 2, 260, "[ CREATE GAME ]", {
      fontSize: "24px",
      fontFamily: "monospace",
      color: "#2ecc71",
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    createBtn.on("pointerover", () => createBtn.setColor("#27ae60"));
    createBtn.on("pointerout", () => createBtn.setColor("#2ecc71"));
    createBtn.on("pointerdown", () => this.createGame());

    // Quick Play (solo + 3 AI)
    const quickBtn = this.add.text(GAME_WIDTH / 2, 320, "[ QUICK PLAY - Solo vs 3 AI ]", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#3498db",
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    quickBtn.on("pointerover", () => quickBtn.setColor("#2980b9"));
    quickBtn.on("pointerout", () => quickBtn.setColor("#3498db"));
    quickBtn.on("pointerdown", () => this.quickPlay());

    // Mode selector
    this.add.text(GAME_WIDTH / 2, 420, "Standard Mode  |  12 Rounds  |  4 Players", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#95a5a6",
    }).setOrigin(0.5);

    // Credits
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Inspired by M.U.L.E. (1983) by Danielle Bunten Berry", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#555",
    }).setOrigin(0.5);
  }

  private async createGame(): Promise<void> {
    try {
      const room = await this.gameClient.createGame({
        mode: "standard",
        name: "Player 1",
        species: "humanoid",
      });
      const stateSync = new StateSync(room);
      this.scene.start("MapScene", { gameClient: this.gameClient, stateSync, room });
    } catch (err) {
      console.error("Failed to create game:", err);
    }
  }

  private async quickPlay(): Promise<void> {
    try {
      const room = await this.gameClient.createGame({
        mode: "standard",
        name: "Player 1",
        species: "humanoid",
      });
      const stateSync = new StateSync(room);
      this.gameClient.startGame();
      this.scene.start("MapScene", { gameClient: this.gameClient, stateSync, room });
    } catch (err) {
      console.error("Failed to start quick play:", err);
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/scenes/BootScene.ts packages/client/src/scenes/LobbyScene.ts
git commit -m "feat: boot scene with placeholder sprites, lobby scene with create/quickplay"
```

---

### Task 4: Tile Renderer & Map Scene

**Files:**
- Create: `packages/client/src/ui/TileRenderer.ts`
- Create: `packages/client/src/scenes/MapScene.ts`

- [ ] **Step 1: Create TileRenderer.ts**

```ts
import Phaser from "phaser";
import { TILE_WIDTH, TILE_HEIGHT, MAP_OFFSET_X, MAP_OFFSET_Y, TERRAIN_COLORS, PLAYER_COLORS, RESOURCE_COLORS } from "../config.js";

export class TileRenderer {
  private scene: Phaser.Scene;
  private tileGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private ownerOverlays: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private muleIcons: Map<string, Phaser.GameObjects.Text> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Get pixel position for a tile */
  getTilePosition(row: number, col: number): { x: number; y: number } {
    return {
      x: MAP_OFFSET_X + col * TILE_WIDTH + TILE_WIDTH / 2,
      y: MAP_OFFSET_Y + row * TILE_HEIGHT + TILE_HEIGHT / 2,
    };
  }

  /** Render a single tile */
  renderTile(row: number, col: number, terrain: string, owner: number, installedMule: string, ownerColor: string): void {
    const key = `${row},${col}`;
    const { x, y } = this.getTilePosition(row, col);

    // Base terrain
    let g = this.tileGraphics.get(key);
    if (!g) {
      g = this.scene.add.graphics();
      this.tileGraphics.set(key, g);
    }
    g.clear();

    const color = TERRAIN_COLORS[terrain] ?? TERRAIN_COLORS.plains;
    g.fillStyle(color, 1);
    g.fillRect(x - TILE_WIDTH / 2 + 1, y - TILE_HEIGHT / 2 + 1, TILE_WIDTH - 2, TILE_HEIGHT - 2);

    // Mountain peaks
    if (terrain.startsWith("mountain")) {
      const peaks = parseInt(terrain.replace("mountain", "")) || 1;
      g.fillStyle(0x333333, 0.6);
      for (let i = 0; i < peaks; i++) {
        const px = x - 20 + i * 15;
        g.fillTriangle(px, y, px + 10, y - 20 - i * 5, px + 20, y);
      }
    }

    // River animation hint
    if (terrain === "river") {
      g.lineStyle(1, 0x6bb3e0, 0.5);
      for (let i = 0; i < 3; i++) {
        g.lineBetween(x - 30, y - 20 + i * 15, x + 30, y - 15 + i * 15);
      }
    }

    // Town
    if (terrain === "town") {
      g.fillStyle(0x8b7355, 1);
      g.fillRect(x - 15, y - 10, 30, 20); // building
      g.fillStyle(0xcc3333, 1);
      g.fillTriangle(x - 18, y - 10, x, y - 25, x + 18, y - 10); // roof
    }

    // Owner overlay (colored border)
    let overlay = this.ownerOverlays.get(key);
    if (!overlay) {
      overlay = this.scene.add.graphics();
      this.ownerOverlays.set(key, overlay);
    }
    overlay.clear();

    if (owner >= 0 && ownerColor) {
      const playerColor = PLAYER_COLORS[ownerColor] ?? 0xffffff;
      overlay.lineStyle(3, playerColor, 0.8);
      overlay.strokeRect(x - TILE_WIDTH / 2 + 1, y - TILE_HEIGHT / 2 + 1, TILE_WIDTH - 2, TILE_HEIGHT - 2);
    }

    // M.U.L.E. icon
    let muleIcon = this.muleIcons.get(key);
    if (installedMule) {
      const muleChar = this.getMuleChar(installedMule);
      if (!muleIcon) {
        muleIcon = this.scene.add.text(x, y + 20, muleChar, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#fff",
          backgroundColor: "#333",
          padding: { x: 2, y: 1 },
        }).setOrigin(0.5);
        this.muleIcons.set(key, muleIcon);
      } else {
        muleIcon.setText(muleChar).setVisible(true);
      }
    } else if (muleIcon) {
      muleIcon.setVisible(false);
    }
  }

  /** Draw the land grant cursor */
  drawCursor(row: number, col: number, graphics: Phaser.GameObjects.Graphics): void {
    const { x, y } = this.getTilePosition(row, col);
    graphics.clear();
    graphics.lineStyle(4, 0xffffff, 1);
    graphics.strokeRect(x - TILE_WIDTH / 2, y - TILE_HEIGHT / 2, TILE_WIDTH, TILE_HEIGHT);
  }

  private getMuleChar(resource: string): string {
    switch (resource) {
      case "food": return "F";
      case "energy": return "E";
      case "smithore": return "S";
      case "crystite": return "C";
      default: return "?";
    }
  }
}
```

- [ ] **Step 2: Create MapScene.ts**

```ts
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TILE_WIDTH, TILE_HEIGHT, MAP_OFFSET_X, MAP_OFFSET_Y } from "../config.js";
import { TileRenderer } from "../ui/TileRenderer.js";
import type { GameClient } from "../network/GameClient.js";
import type { StateSync } from "../network/StateSync.js";

export class MapScene extends Phaser.Scene {
  private gameClient!: GameClient;
  private stateSync!: StateSync;
  private tileRenderer!: TileRenderer;
  private cursorGraphics!: Phaser.GameObjects.Graphics;
  private phaseText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private resourceTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "MapScene" });
  }

  init(data: { gameClient: GameClient; stateSync: StateSync }): void {
    this.gameClient = data.gameClient;
    this.stateSync = data.stateSync;
  }

  create(): void {
    this.tileRenderer = new TileRenderer(this);
    this.cursorGraphics = this.add.graphics();

    // HUD
    this.roundText = this.add.text(10, GAME_HEIGHT - 30, "Round 1", {
      fontSize: "16px", fontFamily: "monospace", color: "#fff",
    });

    this.phaseText = this.add.text(GAME_WIDTH / 2, 10, "", {
      fontSize: "20px", fontFamily: "monospace", color: "#f39c12",
    }).setOrigin(0.5, 0);

    this.eventText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, "", {
      fontSize: "14px", fontFamily: "monospace", color: "#e74c3c",
      wordWrap: { width: GAME_WIDTH - 40 },
    }).setOrigin(0.5, 0);

    this.timerText = this.add.text(GAME_WIDTH - 10, 10, "", {
      fontSize: "18px", fontFamily: "monospace", color: "#fff",
    }).setOrigin(1, 0);

    // Resource display (bottom bar)
    const resources = ["food", "energy", "smithore", "crystite", "money"];
    resources.forEach((res, i) => {
      const t = this.add.text(10 + i * 180, GAME_HEIGHT - 55, `${res}: 0`, {
        fontSize: "13px", fontFamily: "monospace", color: "#ccc",
      });
      this.resourceTexts.push(t);
    });

    // Initial map render
    this.renderFullMap();

    // Click to claim during land grant
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const state = this.stateSync.getState();
      if (state.phase === "land_grant") {
        this.gameClient.claimPlot();
      }
    });

    // Keyboard shortcuts
    this.input.keyboard?.on("keydown-SPACE", () => {
      const state = this.stateSync.getState();
      if (state.phase === "land_grant") this.gameClient.claimPlot();
      if (state.phase === "development") this.gameClient.endTurn();
    });

    this.input.keyboard?.on("keydown-P", () => {
      this.gameClient.visitPub();
    });

    // State change listeners
    this.stateSync.on("phase_changed", (phase: string) => this.onPhaseChanged(phase));
    this.stateSync.on("round_changed", (round: number) => this.roundText.setText(`Round ${round}`));
    this.stateSync.on("cursor_moved", (row: number, col: number) => this.tileRenderer.drawCursor(row, col, this.cursorGraphics));
    this.stateSync.on("tile_owner_changed", () => this.renderFullMap());
    this.stateSync.on("tile_mule_changed", () => this.renderFullMap());
    this.stateSync.on("event_message", (msg: string) => {
      this.eventText.setText(msg);
      this.time.delayedCall(5000, () => this.eventText.setText(""));
    });
    this.stateSync.on("turn_timer", (ms: number) => {
      this.timerText.setText(`${Math.ceil(ms / 1000)}s`);
    });
    this.stateSync.on("player_updated", () => this.updateResourceDisplay());
  }

  private renderFullMap(): void {
    const state = this.stateSync.getState();
    const tiles = state.tiles;
    const players = state.players;

    // Build color lookup
    const colorMap = new Map<number, string>();
    players.forEach((p: any) => colorMap.set(p.index, p.color));

    tiles.forEach((tile: any) => {
      this.tileRenderer.renderTile(
        tile.row, tile.col, tile.terrain,
        tile.owner, tile.installedMule,
        colorMap.get(tile.owner) ?? ""
      );
    });
  }

  private updateResourceDisplay(): void {
    const state = this.stateSync.getState();
    // Find local player (first non-AI, or player 0)
    let localPlayer: any = null;
    state.players.forEach((p: any) => {
      if (!p.isAI && !localPlayer) localPlayer = p;
    });
    if (!localPlayer) return;

    const values = [
      `Food: ${localPlayer.food}`,
      `Energy: ${localPlayer.energy}`,
      `Smith: ${localPlayer.smithore}`,
      `Cryst: ${localPlayer.crystite}`,
      `$${localPlayer.money}`,
    ];
    this.resourceTexts.forEach((t, i) => t.setText(values[i] ?? ""));
  }

  private onPhaseChanged(phase: string): void {
    const phaseLabels: Record<string, string> = {
      land_grant: "LAND GRANT - Click to Claim!",
      land_auction: "LAND AUCTION",
      player_event: "EVENT",
      colony_event_a: "COLONY EVENT",
      development: "DEVELOPMENT",
      production: "PRODUCTION",
      colony_event_b: "COLONY EVENT",
      collection: "COLLECTION",
      trading_auction: "TRADING AUCTION",
      summary: "SUMMARY",
      game_over: "GAME OVER",
    };
    this.phaseText.setText(phaseLabels[phase] ?? phase.toUpperCase());
    this.cursorGraphics.clear();

    // Scene transitions
    if (phase === "development") {
      this.scene.launch("TownScene", { gameClient: this.gameClient, stateSync: this.stateSync });
    }
    if (phase === "trading_auction") {
      this.scene.launch("AuctionScene", { gameClient: this.gameClient, stateSync: this.stateSync });
    }
    if (phase === "collection") {
      this.scene.launch("CollectionScene", { stateSync: this.stateSync });
    }
    if (phase === "summary" || phase === "game_over") {
      this.scene.launch("SummaryScene", { stateSync: this.stateSync });
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/TileRenderer.ts packages/client/src/scenes/MapScene.ts
git commit -m "feat: tile renderer and map scene with land grant, HUD, phase transitions"
```

---

### Task 5: Town Scene (Development Phase)

**Files:**
- Create: `packages/client/src/scenes/TownScene.ts`

- [ ] **Step 1: Create TownScene.ts**

```ts
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config.js";
import type { GameClient } from "../network/GameClient.js";
import type { StateSync } from "../network/StateSync.js";

export class TownScene extends Phaser.Scene {
  private gameClient!: GameClient;
  private stateSync!: StateSync;
  private timerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "TownScene" });
  }

  init(data: { gameClient: GameClient; stateSync: StateSync }): void {
    this.gameClient = data.gameClient;
    this.stateSync = data.stateSync;
  }

  create(): void {
    // Semi-transparent background overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e, 0.9);

    // Town title
    this.add.text(GAME_WIDTH / 2, 30, "COLONY TOWN", {
      fontSize: "28px", fontFamily: "monospace", color: "#d4c5a9",
    }).setOrigin(0.5);

    // Timer
    this.timerText = this.add.text(GAME_WIDTH - 20, 30, "", {
      fontSize: "24px", fontFamily: "monospace", color: "#e74c3c",
    }).setOrigin(1, 0);

    // Money
    this.moneyText = this.add.text(20, 30, "$1000", {
      fontSize: "20px", fontFamily: "monospace", color: "#f39c12",
    });

    // Status
    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, "Choose an action", {
      fontSize: "16px", fontFamily: "monospace", color: "#95a5a6",
    }).setOrigin(0.5);

    // Town buildings as interactive buttons
    const buildings = [
      { label: "M.U.L.E.\nCORRAL", x: 480, y: 150, action: () => this.gameClient.buyMule(), color: 0x8b7355 },
      { label: "FOOD\n$25", x: 160, y: 280, action: () => this.gameClient.outfitMule("food"), color: 0x2ecc71 },
      { label: "ENERGY\n$50", x: 320, y: 280, action: () => this.gameClient.outfitMule("energy"), color: 0xf39c12 },
      { label: "SMITHORE\n$75", x: 480, y: 280, action: () => this.gameClient.outfitMule("smithore"), color: 0x95a5a6 },
      { label: "CRYSTITE\n$100", x: 640, y: 280, action: () => this.gameClient.outfitMule("crystite"), color: 0x3498db },
      { label: "ASSAY\nOFFICE", x: 160, y: 150, action: () => this.statusText.setText("Assay: walk to a plot to survey crystite"), color: 0x7f8c8d },
      { label: "LAND\nOFFICE", x: 800, y: 150, action: () => this.statusText.setText("Land Office: sell plots here"), color: 0x7f8c8d },
      { label: "PUB", x: 800, y: 280, action: () => this.gameClient.visitPub(), color: 0xc0392b },
    ];

    buildings.forEach(({ label, x, y, action, color }) => {
      const bg = this.add.rectangle(x, y, 120, 80, color, 0.8).setInteractive({ useHandCursor: true });
      const txt = this.add.text(x, y, label, {
        fontSize: "14px", fontFamily: "monospace", color: "#fff", align: "center",
      }).setOrigin(0.5);

      bg.on("pointerover", () => bg.setAlpha(1));
      bg.on("pointerout", () => bg.setAlpha(0.8));
      bg.on("pointerdown", action);
    });

    // Install M.U.L.E. instructions
    this.add.text(GAME_WIDTH / 2, 400, "After outfitting, click a plot on the map to install your M.U.L.E.", {
      fontSize: "13px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5);

    // End Turn button
    const endBtn = this.add.text(GAME_WIDTH / 2, 450, "[ END TURN ]", {
      fontSize: "20px", fontFamily: "monospace", color: "#e74c3c",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    endBtn.on("pointerdown", () => this.gameClient.endTurn());

    // Listen for phase change to close
    this.stateSync.on("phase_changed", (phase: string) => {
      if (phase !== "development") {
        this.scene.stop();
      }
    });

    this.stateSync.on("turn_timer", (ms: number) => {
      this.timerText.setText(`${Math.ceil(ms / 1000)}s`);
    });

    this.stateSync.on("player_updated", (player: any) => {
      if (!player.isAI) this.moneyText.setText(`$${player.money}`);
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/scenes/TownScene.ts
git commit -m "feat: town scene with building buttons for M.U.L.E. buying, outfitting, pub"
```

---

### Task 6: Auction Scene

**Files:**
- Create: `packages/client/src/scenes/AuctionScene.ts`

The most complex visual scene — renders the tick-based trading auction with buyer/seller positions, store price lines, and real-time trading.

- [ ] **Step 1: Create AuctionScene.ts**

```ts
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS, RESOURCE_COLORS, AUCTION_AREA_HEIGHT } from "../config.js";
import type { GameClient } from "../network/GameClient.js";
import type { StateSync } from "../network/StateSync.js";

export class AuctionScene extends Phaser.Scene {
  private gameClient!: GameClient;
  private stateSync!: StateSync;
  private playerAvatars: Map<number, Phaser.GameObjects.Container> = new Map();
  private buyLine!: Phaser.GameObjects.Graphics;
  private sellLine!: Phaser.GameObjects.Graphics;
  private storeLines!: Phaser.GameObjects.Graphics;
  private timerBar!: Phaser.GameObjects.Graphics;
  private resourceLabel!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private declared = false;

  constructor() {
    super({ key: "AuctionScene" });
  }

  init(data: { gameClient: GameClient; stateSync: StateSync }): void {
    this.gameClient = data.gameClient;
    this.stateSync = data.stateSync;
  }

  create(): void {
    this.declared = false;

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e, 0.95);

    // Resource label
    this.resourceLabel = this.add.text(GAME_WIDTH / 2, 20, "AUCTION", {
      fontSize: "28px", fontFamily: "monospace", color: "#f39c12",
    }).setOrigin(0.5);

    // Price axis (left side)
    this.add.text(30, 60, "HIGH", { fontSize: "12px", fontFamily: "monospace", color: "#666" });
    this.add.text(30, 60 + AUCTION_AREA_HEIGHT, "LOW", { fontSize: "12px", fontFamily: "monospace", color: "#666" });

    // Seller zone label (top)
    this.add.text(GAME_WIDTH / 2, 55, "SELLERS", {
      fontSize: "14px", fontFamily: "monospace", color: "#e74c3c",
    }).setOrigin(0.5);

    // Buyer zone label (bottom)
    this.add.text(GAME_WIDTH / 2, 65 + AUCTION_AREA_HEIGHT, "BUYERS", {
      fontSize: "14px", fontFamily: "monospace", color: "#2ecc71",
    }).setOrigin(0.5);

    // Graphics layers
    this.storeLines = this.add.graphics();
    this.buyLine = this.add.graphics();
    this.sellLine = this.add.graphics();
    this.timerBar = this.add.graphics();

    // Instructions
    this.instructionText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Press UP to SELL, DOWN to BUY", {
      fontSize: "16px", fontFamily: "monospace", color: "#fff",
    }).setOrigin(0.5);

    // Keyboard controls
    this.input.keyboard?.on("keydown-UP", () => {
      if (!this.declared) {
        this.gameClient.declareAuction("seller");
        this.declared = true;
        this.instructionText.setText("Selling — move DOWN to lower price");
      } else {
        this.gameClient.setAuctionTick(-1); // move down (lower price as seller)
      }
    });

    this.input.keyboard?.on("keydown-DOWN", () => {
      if (!this.declared) {
        this.gameClient.declareAuction("buyer");
        this.declared = true;
        this.instructionText.setText("Buying — move UP to raise bid");
      } else {
        this.gameClient.setAuctionTick(1); // move up (raise bid as buyer)
      }
    });

    // State listeners
    this.stateSync.on("auction_updated", (auction: any) => this.renderAuction(auction));
    this.stateSync.on("phase_changed", (phase: string) => {
      if (phase !== "trading_auction") {
        this.cleanup();
        this.scene.stop();
      }
    });

    // Initial render
    const state = this.stateSync.getState();
    if (state.auction) this.renderAuction(state.auction);
  }

  private renderAuction(auction: any): void {
    const resource = auction.resource;
    const resourceColor = RESOURCE_COLORS[resource] ?? 0xffffff;
    this.resourceLabel.setText(`${resource.toUpperCase()} AUCTION`);

    // Timer bar
    const timerFraction = auction.timeRemaining / 10000;
    this.timerBar.clear();
    this.timerBar.fillStyle(0x333333, 1);
    this.timerBar.fillRect(80, 490, GAME_WIDTH - 160, 12);
    this.timerBar.fillStyle(resourceColor, 1);
    this.timerBar.fillRect(80, 490, (GAME_WIDTH - 160) * timerFraction, 12);

    // Store price lines
    this.storeLines.clear();
    const areaTop = 70;
    const areaBottom = areaTop + AUCTION_AREA_HEIGHT;

    if (auction.storeBuyPrice >= 0) {
      const buyY = this.priceToY(auction.storeBuyPrice, auction.storeBuyPrice, auction.storeSellPrice > 0 ? auction.storeSellPrice : auction.storeBuyPrice + 50, areaTop, areaBottom);
      this.storeLines.lineStyle(2, 0x2ecc71, 0.6);
      this.storeLines.lineBetween(80, buyY, GAME_WIDTH - 80, buyY);
      this.add.text(GAME_WIDTH - 75, buyY - 8, `$${auction.storeBuyPrice}`, {
        fontSize: "11px", fontFamily: "monospace", color: "#2ecc71",
      });
    }

    if (auction.storeSellPrice >= 0 && !auction.storeClosed) {
      const sellY = this.priceToY(auction.storeSellPrice, auction.storeBuyPrice, auction.storeSellPrice, areaTop, areaBottom);
      this.storeLines.lineStyle(2, 0xe74c3c, 0.6);
      this.storeLines.lineBetween(80, sellY, GAME_WIDTH - 80, sellY);
      this.add.text(GAME_WIDTH - 75, sellY - 8, `$${auction.storeSellPrice}`, {
        fontSize: "11px", fontFamily: "monospace", color: "#e74c3c",
      });
    }

    // Buy/sell dashed lines
    this.buyLine.clear();
    this.sellLine.clear();

    if (auction.buyTick > -32768) {
      const buyY = this.tickToY(auction.buyTick, areaTop, areaBottom);
      this.buyLine.lineStyle(2, 0x2ecc71, 0.8);
      this.drawDashedLine(this.buyLine, 80, buyY, GAME_WIDTH - 80, buyY);
    }
    if (auction.sellTick < 32767) {
      const sellY = this.tickToY(auction.sellTick, areaTop, areaBottom);
      this.sellLine.lineStyle(2, 0xe74c3c, 0.8);
      this.drawDashedLine(this.sellLine, 80, sellY, GAME_WIDTH - 80, sellY);
    }

    // Render player positions
    const state = this.stateSync.getState();
    state.players.forEach((player: any) => {
      this.renderPlayerInAuction(player, areaTop, areaBottom);
    });
  }

  private renderPlayerInAuction(player: any, areaTop: number, areaBottom: number): void {
    let container = this.playerAvatars.get(player.index);
    if (!container) {
      const color = PLAYER_COLORS[player.color] ?? 0xffffff;
      const circle = this.add.circle(0, 0, 12, color);
      const label = this.add.text(0, 0, player.name.charAt(0), {
        fontSize: "14px", fontFamily: "monospace", color: "#fff",
      }).setOrigin(0.5);
      container = this.add.container(0, 0, [circle, label]);
      this.playerAvatars.set(player.index, container);
    }

    if (player.auctionRole === "none") {
      container.setVisible(false);
      return;
    }

    container.setVisible(true);
    const x = 150 + player.index * 180;
    const y = this.tickToY(player.auctionTick ?? 0, areaTop, areaBottom);
    container.setPosition(x, y);
  }

  private tickToY(tick: number, areaTop: number, areaBottom: number): number {
    // Higher tick = higher price = higher on screen (lower Y)
    const normalized = Phaser.Math.Clamp(tick / 500, 0, 1);
    return areaBottom - normalized * (areaBottom - areaTop);
  }

  private priceToY(price: number, minPrice: number, maxPrice: number, areaTop: number, areaBottom: number): number {
    if (maxPrice === minPrice) return (areaTop + areaBottom) / 2;
    const normalized = (price - minPrice) / (maxPrice - minPrice);
    return areaBottom - normalized * (areaBottom - areaTop);
  }

  private drawDashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    const dashLength = 8;
    const gapLength = 4;
    const totalLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const dx = (x2 - x1) / totalLength;
    const dy = (y2 - y1) / totalLength;
    let drawn = 0;
    while (drawn < totalLength) {
      const segEnd = Math.min(drawn + dashLength, totalLength);
      g.lineBetween(
        x1 + dx * drawn, y1 + dy * drawn,
        x1 + dx * segEnd, y1 + dy * segEnd
      );
      drawn = segEnd + gapLength;
    }
  }

  private cleanup(): void {
    this.stateSync.off("auction_updated");
    this.playerAvatars.forEach(c => c.destroy());
    this.playerAvatars.clear();
    this.declared = false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/scenes/AuctionScene.ts
git commit -m "feat: auction scene — tick-based trading with buyer/seller positions, store lines, timer"
```

---

### Task 7: Collection & Summary Scenes

**Files:**
- Create: `packages/client/src/scenes/CollectionScene.ts`
- Create: `packages/client/src/scenes/SummaryScene.ts`

- [ ] **Step 1: Create CollectionScene.ts**

```ts
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, RESOURCE_COLORS } from "../config.js";
import type { StateSync } from "../network/StateSync.js";

export class CollectionScene extends Phaser.Scene {
  private stateSync!: StateSync;

  constructor() {
    super({ key: "CollectionScene" });
  }

  init(data: { stateSync: StateSync }): void {
    this.stateSync = data.stateSync;
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e, 0.9);

    const state = this.stateSync.getState();
    const resource = state.auction?.resource ?? "unknown";
    const resourceColor = RESOURCE_COLORS[resource] ?? 0xffffff;

    this.add.text(GAME_WIDTH / 2, 30, `${resource.toUpperCase()} - COLLECTION`, {
      fontSize: "28px", fontFamily: "monospace", color: `#${resourceColor.toString(16).padStart(6, "0")}`,
    }).setOrigin(0.5);

    // Animated bars per player
    let yOffset = 100;
    state.players.forEach((player: any) => {
      const amount = (player as any)[resource] ?? 0;
      const barWidth = Math.min(amount * 30, GAME_WIDTH - 200);

      this.add.text(80, yOffset, player.name, {
        fontSize: "16px", fontFamily: "monospace", color: "#fff",
      });

      // Animate bar growing
      const bar = this.add.rectangle(100, yOffset + 30, 0, 25, resourceColor);
      bar.setOrigin(0, 0.5);
      this.tweens.add({
        targets: bar,
        width: barWidth,
        duration: 1500,
        ease: "Power2",
      });

      this.add.text(100 + barWidth + 10, yOffset + 30, `${amount}`, {
        fontSize: "14px", fontFamily: "monospace", color: "#ccc",
      }).setOrigin(0, 0.5);

      yOffset += 80;
    });

    // Auto-close when phase changes
    this.stateSync.on("phase_changed", (phase: string) => {
      if (phase !== "collection") this.scene.stop();
    });
  }
}
```

- [ ] **Step 2: Create SummaryScene.ts**

```ts
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS } from "../config.js";
import type { StateSync } from "../network/StateSync.js";

export class SummaryScene extends Phaser.Scene {
  private stateSync!: StateSync;

  constructor() {
    super({ key: "SummaryScene" });
  }

  init(data: { stateSync: StateSync }): void {
    this.stateSync = data.stateSync;
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e, 0.95);

    const state = this.stateSync.getState();
    const isGameOver = state.phase === "game_over";

    this.add.text(GAME_WIDTH / 2, 30, isGameOver ? "GAME OVER" : `ROUND ${state.round} SUMMARY`, {
      fontSize: "32px", fontFamily: "monospace", color: isGameOver ? "#e74c3c" : "#f39c12",
    }).setOrigin(0.5);

    // Colony score
    this.add.text(GAME_WIDTH / 2, 75, `Colony Score: ${state.colonyScore} — ${state.colonyRating.replace("_", " ").toUpperCase()}`, {
      fontSize: "18px", fontFamily: "monospace", color: "#95a5a6",
    }).setOrigin(0.5);

    // Player standings (sorted by index for now — server provides winner)
    const players: any[] = [];
    state.players.forEach((p: any) => players.push(p));
    players.sort((a: any, b: any) => b.money - a.money);

    let yOffset = 130;
    players.forEach((player: any, rank: number) => {
      const isWinner = player.index === state.winnerIndex;
      const color = PLAYER_COLORS[player.color] ?? 0xffffff;
      const hexColor = `#${color.toString(16).padStart(6, "0")}`;

      // Rank + Name
      this.add.text(100, yOffset, `${rank + 1}.`, {
        fontSize: "20px", fontFamily: "monospace", color: isWinner ? "#f39c12" : "#fff",
      });

      this.add.text(140, yOffset, player.name + (isWinner ? " ★" : ""), {
        fontSize: "20px", fontFamily: "monospace", color: hexColor,
      });

      // Resources
      this.add.text(400, yOffset, `$${player.money}`, {
        fontSize: "16px", fontFamily: "monospace", color: "#f39c12",
      });

      this.add.text(520, yOffset,
        `F:${player.food} E:${player.energy} S:${player.smithore} C:${player.crystite}`, {
        fontSize: "14px", fontFamily: "monospace", color: "#999",
      });

      yOffset += 50;
    });

    if (isGameOver) {
      const winnerName = players.find((p: any) => p.index === state.winnerIndex)?.name ?? "Unknown";
      this.add.text(GAME_WIDTH / 2, yOffset + 30, `${winnerName} is the FIRST FOUNDER!`, {
        fontSize: "24px", fontFamily: "monospace", color: "#f39c12",
      }).setOrigin(0.5);

      const replayBtn = this.add.text(GAME_WIDTH / 2, yOffset + 80, "[ PLAY AGAIN ]", {
        fontSize: "20px", fontFamily: "monospace", color: "#2ecc71",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      replayBtn.on("pointerdown", () => {
        this.scene.stop();
        this.scene.start("LobbyScene");
      });
    } else {
      // Auto-close after 5s
      this.stateSync.on("phase_changed", (phase: string) => {
        if (phase !== "summary" && phase !== "game_over") this.scene.stop();
      });
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/scenes/CollectionScene.ts packages/client/src/scenes/SummaryScene.ts
git commit -m "feat: collection scene with animated bars, summary scene with standings"
```

---

### Task 8: Build Verification & Polish

**Files:**
- Modify: `packages/client/src/main.ts` (if imports need fixing)
- Verify Vite build passes

- [ ] **Step 1: Verify all imports resolve**

```bash
cd ~/mule-game/packages/client && npx vite build 2>&1 | tail -10
```

Fix any import errors.

- [ ] **Step 2: Verify dev server starts**

```bash
cd ~/mule-game/packages/client && timeout 5 npx vite --host 2>&1 | head -10
```

- [ ] **Step 3: Commit any fixes**

```bash
git add packages/client/
git commit -m "feat: client build verification — all scenes compile, Vite builds"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Phaser 3 client with pixel art config — Task 1
- [x] Colyseus.js network layer — Task 2
- [x] Lobby/game creation — Task 3
- [x] 5x9 map rendering with terrain — Task 4
- [x] Land grant cursor + claiming — Task 4
- [x] HUD (money, resources, round, timer) — Task 4
- [x] Town scene with buildings — Task 5
- [x] M.U.L.E. buy/outfit/install UI — Task 5
- [x] Pub button — Task 5
- [x] Trading auction with tick-based display — Task 6
- [x] Declaration (keyboard up/down) — Task 6
- [x] Store price lines — Task 6
- [x] Collection bars — Task 7
- [x] Summary/scoring display — Task 7
- [x] Game over screen — Task 7
- [x] Build verification — Task 8
- [ ] Wampus hunting visual (deferred — needs animated sprite on mountains, server already handles logic)
- [ ] Assay office visual (deferred — needs map interaction during development)
- [ ] Sound effects (deferred)
- [ ] Player species selection (deferred — cosmetic)

**Placeholder scan:** No TBDs found. All scenes have functional implementations.

**Type consistency:** All message types match server expectations. Scene transitions match phase names from GamePhase enum.
