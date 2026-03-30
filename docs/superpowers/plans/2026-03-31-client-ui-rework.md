# Client UI Rework — Avatar-Based Movement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Phaser 3 client from button-based overlays to avatar-based walking movement matching the Planet M.U.L.E. Java reference.

**Architecture:** MapScene becomes the primary game scene with inline avatar movement. During development, the player controls an avatar sprite with arrow keys. Walking into the town tile switches to a TownView sub-rendering (buildings at fixed positions). Auctions use a vertical bar where players move up/down. Collection shows 8-stage animated bars. Summary has a walking player lineup. TownScene is removed entirely.

**Tech Stack:** Phaser 3.87, TypeScript, Colyseus SDK 0.17, @mule-game/shared constants

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/config.ts` | Modify | Add town building positions, avatar speed, resource colors |
| `src/main.ts` | Modify | Remove TownScene import, add IntroScene |
| `src/sprites/Avatar.ts` | Create | 4-directional sprite with smooth movement, MULE-carrying state |
| `src/scenes/IntroScene.ts` | Create | Ship landing / round intro display |
| `src/scenes/MapScene.ts` | Rewrite | Development with avatar movement, town sub-view toggle, wampus |
| `src/views/TownView.ts` | Create | Town interior rendering — 8 buildings at fixed positions |
| `src/scenes/AuctionScene.ts` | Rewrite | Vertical bar auction with physical player positions |
| `src/scenes/CollectionScene.ts` | Rewrite | 8-stage animated resource bars per Java spec |
| `src/scenes/SummaryScene.ts` | Rewrite | Walking player lineup + score table |
| `src/scenes/TownScene.ts` | Delete | Merged into MapScene via TownView |
| `src/ui/TileRenderer.ts` | Modify | Add crystite indicators, smithore quality, wampus blinking |
| `src/ui/HUD.ts` | Create | Reusable HUD for timer, resources, money, phase display |
| `src/network/StateSync.ts` | Keep | Already updated with new fields |
| `src/network/GameClient.ts` | Modify | Add avatar movement messages |

---

### Task 1: Avatar Sprite System

**Files:**
- Create: `packages/client/src/sprites/Avatar.ts`
- Modify: `packages/client/src/config.ts`

The avatar is the player's character on the map. It moves smoothly in 4 directions with arrow keys. It can carry a MULE (visual follower sprite). It has idle and walking states per direction.

Since the user is blind and we can't use visual sprites, we use colored rectangles with direction indicators.

- [ ] **Step 1: Add avatar constants to config**

Add to `packages/client/src/config.ts`:
```typescript
export const AVATAR_SIZE = 24;
export const AVATAR_SPEED = 200; // pixels per second
export const MULE_FOLLOW_OFFSET = 16;

export const TOWN_BUILDINGS = {
  corral:   { x: 480, y: 150, w: 120, h: 80, label: "M.U.L.E. CORRAL", key: "B", color: 0x8b7355 },
  food:     { x: 160, y: 280, w: 120, h: 80, label: "FOOD STORE",      key: "1", color: 0x2ecc71 },
  energy:   { x: 320, y: 280, w: 120, h: 80, label: "ENERGY STORE",    key: "2", color: 0xf39c12 },
  smithore: { x: 480, y: 280, w: 120, h: 80, label: "SMITHORE STORE",  key: "3", color: 0x95a5a6 },
  crystite: { x: 640, y: 280, w: 120, h: 80, label: "CRYSTITE STORE",  key: "4", color: 0x3498db },
  assay:    { x: 160, y: 150, w: 120, h: 80, label: "ASSAY OFFICE",    key: "A", color: 0x7f8c8d },
  land:     { x: 800, y: 150, w: 120, h: 80, label: "LAND OFFICE",     key: "L", color: 0x7f8c8d },
  pub:      { x: 800, y: 280, w: 120, h: 80, label: "PUB",             key: "P", color: 0x6c5d4f },
} as const;
```

- [ ] **Step 2: Create Avatar class**

Create `packages/client/src/sprites/Avatar.ts`:
```typescript
import Phaser from "phaser";
import { AVATAR_SIZE, AVATAR_SPEED, MULE_FOLLOW_OFFSET, PLAYER_COLORS } from "../config.js";

type Direction = "north" | "south" | "east" | "west" | "idle";

export class Avatar {
  private body: Phaser.GameObjects.Rectangle;
  private dirIndicator: Phaser.GameObjects.Triangle;
  private muleSprite: Phaser.GameObjects.Rectangle | null = null;
  private scene: Phaser.Scene;
  private _direction: Direction = "south";
  private _carrying: string = ""; // "" or resource type
  private targetX: number;
  private targetY: number;
  public playerIndex: number;
  public color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, playerIndex: number, colorKey: string) {
    this.scene = scene;
    this.playerIndex = playerIndex;
    this.color = PLAYER_COLORS[colorKey] ?? 0xffffff;
    this.targetX = x;
    this.targetY = y;

    this.body = scene.add.rectangle(x, y, AVATAR_SIZE, AVATAR_SIZE, this.color);
    this.body.setDepth(10);

    // Direction indicator (small triangle pointing current direction)
    this.dirIndicator = scene.add.triangle(x, y - AVATAR_SIZE / 2 - 4, 0, 8, 6, 0, 12, 8, 0xffffff);
    this.dirIndicator.setDepth(11);
  }

  get x(): number { return this.body.x; }
  get y(): number { return this.body.y; }
  get direction(): Direction { return this._direction; }
  get carrying(): string { return this._carrying; }

  setPosition(x: number, y: number): void {
    this.body.setPosition(x, y);
    this.targetX = x;
    this.targetY = y;
    this.updateIndicator();
    this.updateMulePosition();
  }

  moveTo(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  moveDirection(dir: Direction): void {
    this._direction = dir;
    const speed = AVATAR_SPEED / 60; // per-frame at 60fps
    switch (dir) {
      case "north": this.targetY = this.body.y - speed; break;
      case "south": this.targetY = this.body.y + speed; break;
      case "east":  this.targetX = this.body.x + speed; break;
      case "west":  this.targetX = this.body.x - speed; break;
    }
  }

  update(delta: number): void {
    const speed = AVATAR_SPEED * delta / 1000;
    const dx = this.targetX - this.body.x;
    const dy = this.targetY - this.body.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const ratio = Math.min(speed / dist, 1);
      this.body.x += dx * ratio;
      this.body.y += dy * ratio;
    } else {
      this.body.x = this.targetX;
      this.body.y = this.targetY;
      this._direction = "idle";
    }

    this.updateIndicator();
    this.updateMulePosition();
  }

  pickUpMule(resource: string): void {
    this._carrying = resource;
    if (!this.muleSprite) {
      this.muleSprite = this.scene.add.rectangle(this.body.x, this.body.y + MULE_FOLLOW_OFFSET, 16, 16, 0xffd700);
      this.muleSprite.setDepth(9);
    }
  }

  dropMule(): string {
    const was = this._carrying;
    this._carrying = "";
    if (this.muleSprite) {
      this.muleSprite.destroy();
      this.muleSprite = null;
    }
    return was;
  }

  destroy(): void {
    this.body.destroy();
    this.dirIndicator.destroy();
    this.muleSprite?.destroy();
  }

  setVisible(v: boolean): void {
    this.body.setVisible(v);
    this.dirIndicator.setVisible(v);
    this.muleSprite?.setVisible(v);
  }

  private updateIndicator(): void {
    this.dirIndicator.setPosition(this.body.x, this.body.y - AVATAR_SIZE / 2 - 6);
  }

  private updateMulePosition(): void {
    if (this.muleSprite) {
      this.muleSprite.setPosition(this.body.x, this.body.y + MULE_FOLLOW_OFFSET);
    }
  }

  /** Get the tile row/col the avatar is currently on */
  getTile(mapOffsetX: number, mapOffsetY: number, tileW: number, tileH: number): { row: number; col: number } {
    const col = Math.floor((this.body.x - mapOffsetX) / tileW);
    const row = Math.floor((this.body.y - mapOffsetY) / tileH);
    return { row: Math.max(0, Math.min(4, row)), col: Math.max(0, Math.min(8, col)) };
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`
Expected: no errors referencing Avatar.ts

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/sprites/Avatar.ts packages/client/src/config.ts
git commit -m "feat(client): avatar sprite system with 4-direction movement and MULE carrying"
```

---

### Task 2: HUD Component

**Files:**
- Create: `packages/client/src/ui/HUD.ts`

Reusable HUD rendering for timer, resources, money, phase, and player info. Used by MapScene and TownView.

- [ ] **Step 1: Create HUD class**

Create `packages/client/src/ui/HUD.ts`:
```typescript
import Phaser from "phaser";
import { GAME_WIDTH, RESOURCE_COLORS } from "../config.js";

export class HUD {
  private container: Phaser.GameObjects.Container;
  private phaseText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private resourceTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private moneyText: Phaser.GameObjects.Text;
  private infoText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);

    // Top bar background
    const bg = scene.add.rectangle(GAME_WIDTH / 2, 12, GAME_WIDTH, 24, 0x000000, 0.7);
    this.container.add(bg);

    this.phaseText = scene.add.text(8, 2, "", { fontSize: "14px", color: "#d4c5a9", fontFamily: "monospace" });
    this.timerText = scene.add.text(GAME_WIDTH - 8, 2, "", { fontSize: "14px", color: "#f39c12", fontFamily: "monospace" }).setOrigin(1, 0);
    this.moneyText = scene.add.text(GAME_WIDTH / 2, 2, "", { fontSize: "14px", color: "#2ecc71", fontFamily: "monospace" }).setOrigin(0.5, 0);

    this.container.add([this.phaseText, this.timerText, this.moneyText]);

    // Bottom resource bar
    const bottomBg = scene.add.rectangle(GAME_WIDTH / 2, 540 - 12, GAME_WIDTH, 24, 0x000000, 0.7);
    this.container.add(bottomBg);

    const resources = ["food", "energy", "smithore", "crystite"];
    resources.forEach((r, i) => {
      const x = 60 + i * 220;
      const colorHex = RESOURCE_COLORS[r] ?? 0xffffff;
      const hexStr = "#" + colorHex.toString(16).padStart(6, "0");
      const text = scene.add.text(x, 540 - 22, "", { fontSize: "13px", color: hexStr, fontFamily: "monospace" });
      this.resourceTexts.set(r, text);
      this.container.add(text);
    });

    // Info line (above bottom bar)
    this.infoText = scene.add.text(GAME_WIDTH / 2, 540 - 35, "", { fontSize: "12px", color: "#888888", fontFamily: "monospace" }).setOrigin(0.5, 0);
    this.container.add(this.infoText);
  }

  update(data: {
    phase: string; round: number; timer: number; money: number;
    food: number; energy: number; smithore: number; crystite: number;
    prevFood?: number; prevEnergy?: number;
    spoiledFood?: number; spoiledEnergy?: number;
    info?: string;
  }): void {
    this.phaseText.setText(`R${data.round} ${data.phase.toUpperCase()}`);
    this.timerText.setText(data.timer > 0 ? `${Math.ceil(data.timer / 1000)}s` : "");
    this.moneyText.setText(`$${data.money}`);

    const foodDelta = data.prevFood !== undefined ? data.food - data.prevFood : 0;
    const energyDelta = data.prevEnergy !== undefined ? data.energy - data.prevEnergy : 0;
    const foodStr = foodDelta !== 0 ? ` (${foodDelta > 0 ? "+" : ""}${foodDelta})` : "";
    const energyStr = energyDelta !== 0 ? ` (${energyDelta > 0 ? "+" : ""}${energyDelta})` : "";

    this.resourceTexts.get("food")?.setText(`F:${data.food}${foodStr}`);
    this.resourceTexts.get("energy")?.setText(`E:${data.energy}${energyStr}`);
    this.resourceTexts.get("smithore")?.setText(`S:${data.smithore}`);
    this.resourceTexts.get("crystite")?.setText(`C:${data.crystite}`);

    this.infoText.setText(data.info ?? "");
  }

  setVisible(v: boolean): void { this.container.setVisible(v); }
  destroy(): void { this.container.destroy(); }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/HUD.ts
git commit -m "feat(client): reusable HUD component for timer, resources, phase display"
```

---

### Task 3: TownView — Walk-In Town Interior

**Files:**
- Create: `packages/client/src/views/TownView.ts`

Town interior rendering. When the avatar walks onto the town tile during development, MapScene switches to this view. Shows 8 buildings at fixed positions. Avatar walks between buildings. Walking into a building triggers the action.

- [ ] **Step 1: Create TownView**

Create `packages/client/src/views/TownView.ts`:
```typescript
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TOWN_BUILDINGS } from "../config.js";
import type { Avatar } from "../sprites/Avatar.js";

export type TownAction =
  | { type: "buy_mule" }
  | { type: "outfit_mule"; resource: string }
  | { type: "visit_pub" }
  | { type: "assay" }
  | { type: "sell_plot" }
  | null;

export class TownView {
  private container: Phaser.GameObjects.Container;
  private buildings: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private labels: Phaser.GameObjects.Text[] = [];
  private active = false;

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
    this.container.setDepth(50);
    this.container.setVisible(false);

    // Dark overlay
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e, 0.92);
    this.container.add(overlay);

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, 40, "COLONY TOWN", {
      fontSize: "28px", color: "#d4c5a9", fontFamily: "monospace",
    }).setOrigin(0.5);
    this.container.add(title);

    // Draw buildings
    for (const [key, b] of Object.entries(TOWN_BUILDINGS)) {
      const rect = scene.add.rectangle(b.x, b.y, b.w, b.h, b.color, 0.8);
      rect.setStrokeStyle(2, 0xffffff, 0.5);
      this.container.add(rect);
      this.buildings.set(key, rect);

      const label = scene.add.text(b.x, b.y - 10, b.label, {
        fontSize: "11px", color: "#ffffff", fontFamily: "monospace",
      }).setOrigin(0.5);
      this.container.add(label);
      this.labels.push(label);

      const keyLabel = scene.add.text(b.x, b.y + 15, `[${b.key}]`, {
        fontSize: "10px", color: "#d4c5a9", fontFamily: "monospace",
      }).setOrigin(0.5);
      this.container.add(keyLabel);
      this.labels.push(keyLabel);
    }

    // Instructions
    const help = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50,
      "Arrow keys to move | Walk into building or press key | ESC = back to map", {
        fontSize: "11px", color: "#888888", fontFamily: "monospace",
      }).setOrigin(0.5);
    this.container.add(help);
  }

  show(avatar: Avatar): void {
    this.active = true;
    this.container.setVisible(true);
    // Place avatar at town center
    avatar.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
    avatar.setVisible(true);
  }

  hide(): void {
    this.active = false;
    this.container.setVisible(false);
  }

  isActive(): boolean { return this.active; }

  /** Check if avatar overlaps any building, return the action */
  checkBuildingOverlap(avatar: Avatar): TownAction {
    for (const [key, rect] of this.buildings) {
      const dx = Math.abs(avatar.x - rect.x);
      const dy = Math.abs(avatar.y - rect.y);
      if (dx < rect.width / 2 + 8 && dy < rect.height / 2 + 8) {
        return this.buildingToAction(key, avatar);
      }
    }
    return null;
  }

  /** Keyboard shortcut check */
  checkKeyAction(keyCode: string, avatar: Avatar): TownAction {
    switch (keyCode) {
      case "B": return { type: "buy_mule" };
      case "1": return { type: "outfit_mule", resource: "food" };
      case "2": return { type: "outfit_mule", resource: "energy" };
      case "3": return { type: "outfit_mule", resource: "smithore" };
      case "4": return { type: "outfit_mule", resource: "crystite" };
      case "P": return { type: "visit_pub" };
      case "A": return { type: "assay" };
      case "L": return { type: "sell_plot" };
      default: return null;
    }
  }

  private buildingToAction(key: string, avatar: Avatar): TownAction {
    switch (key) {
      case "corral": return { type: "buy_mule" };
      case "food": return { type: "outfit_mule", resource: "food" };
      case "energy": return { type: "outfit_mule", resource: "energy" };
      case "smithore": return { type: "outfit_mule", resource: "smithore" };
      case "crystite": return { type: "outfit_mule", resource: "crystite" };
      case "pub": return { type: "visit_pub" };
      case "assay": return { type: "assay" };
      case "land": return { type: "sell_plot" };
      default: return null;
    }
  }

  destroy(): void { this.container.destroy(); }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/views/TownView.ts
git commit -m "feat(client): TownView with walk-in buildings and keyboard shortcuts"
```

---

### Task 4: Rewrite MapScene — Avatar Movement During Development

**Files:**
- Rewrite: `packages/client/src/scenes/MapScene.ts`
- Delete: `packages/client/src/scenes/TownScene.ts`
- Modify: `packages/client/src/main.ts`

This is the biggest task. MapScene must handle:
1. Land grant — cursor highlight, SPACE to claim
2. Development — avatar walks the map with arrow keys, town sub-view, MULE install on click
3. Other phases — display-only (events, production, etc.)

- [ ] **Step 1: Remove TownScene from main.ts**

In `packages/client/src/main.ts`, remove the TownScene import and remove it from the scene array. Add IntroScene placeholder (Task 7).

- [ ] **Step 2: Rewrite MapScene**

Rewrite `packages/client/src/scenes/MapScene.ts`. The full implementation should:

**create():**
- Get room/gameClient/stateSync from registry (existing pattern)
- Create TileRenderer for the 9x5 grid
- Create HUD
- Create TownView (hidden initially)
- Create Avatar (hidden initially)
- Set up keyboard listeners: arrows, SPACE, ESC, B, 1-4, P, A, L
- Set up StateSync event listeners for phase changes, cursor moves, wampus
- Set up pointer click handler for tile interaction

**update(time, delta):**
- Call stateSync.poll()
- Update HUD with current state
- Handle phase-specific logic:

**Land Grant mode:**
- Render cursor highlight at landGrantCursorRow/Col
- SPACE claims current tile
- No avatar movement

**Development mode:**
- Avatar visible and controllable with arrow keys
- Continuous movement while key held (not tile-snapping)
- Clamp avatar to map bounds (MAP_OFFSET_X to MAP_OFFSET_X + 9*TILE_WIDTH)
- Check if avatar is on town tile (row 2, col 4):
  - If yes and not in town view: show TownView, hide map tiles
  - If in town view and ESC pressed: hide TownView, show map tiles, place avatar on town tile
- In town view: check building overlaps and keyboard shortcuts → send server messages
- On map: click owned tile while carrying MULE → send install_mule
- Wampus rendering: if wampusVisible, draw flashing "W" at tile position
- Timer countdown display

**Other phases:**
- Hide avatar
- Display event messages
- Auto-advance handled by server

- [ ] **Step 3: Wire up server messages**

The MapScene sends these messages based on avatar interactions:
- `claim_plot` — SPACE during land_grant
- `buy_mule` — walk into corral or press B in town
- `outfit_mule` — walk into resource store or press 1-4 in town
- `install_mule` — click owned tile on map while carrying MULE
- `visit_pub` — walk into pub or press P in town
- `assay` — walk into assay office or press A in town
- `sell_plot` — press L in town (land office)
- `end_turn` — SPACE during development (when not in town)
- `catch_wampus` — SPACE when avatar is on wampus tile

- [ ] **Step 4: Delete TownScene.ts**

```bash
rm packages/client/src/scenes/TownScene.ts
```

- [ ] **Step 5: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`
Fix any type errors.

- [ ] **Step 6: Commit**

```bash
git add -A packages/client/src/
git commit -m "feat(client): rewrite MapScene with avatar movement and walk-in town"
```

---

### Task 5: Rewrite AuctionScene — Vertical Bar

**Files:**
- Rewrite: `packages/client/src/scenes/AuctionScene.ts`

Auction uses a vertical bar. Players move up (sell higher) or down (buy lower). Store floor/ceiling shown as horizontal lines. Buyers at bottom, sellers at top. When buyer and seller meet = trade.

- [ ] **Step 1: Rewrite AuctionScene**

The auction scene should show:
- Resource name and color at top
- Vertical auction bar (full height minus HUD)
- Store buy price = floor line (labeled)
- Store sell price = ceiling line (labeled, removed when store exhausted)
- Player position markers (colored rectangles) at their tick positions
- Timer countdown
- Trade flash animation when trades execute
- Current price at player's position

**Controls:**
- UP arrow: move position up (higher price / seller direction)
- DOWN arrow: move position down (lower price / buyer direction)
- Player's position sends `set_auction_tick` to server

**Layout:**
- Bar area: x=200 to x=760, full height
- Price labels: left side
- Player markers: positioned vertically based on tick * pixelRatio (2px per tick)
- Store lines: horizontal dashed lines at floor/ceiling prices
- Timer: top-right via HUD

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/scenes/AuctionScene.ts
git commit -m "feat(client): rewrite auction scene with vertical bar and physical movement"
```

---

### Task 6: Rewrite CollectionScene — 8-Stage Animated Bars

**Files:**
- Rewrite: `packages/client/src/scenes/CollectionScene.ts`

Collection shows animated vertical bars per player through 8 sequential stages matching the Java reference.

- [ ] **Step 1: Rewrite CollectionScene**

**8 stages** with timing from constants:
1. **Previous Units** (2.5s) — bars at prevFood/prevEnergy/etc heights
2. **Usage** (1.0s) — bars animate down showing food consumption
3. **Current Units** (2.5s) — bars at post-consumption levels
4. **Spoilage** (1.0s) — bars animate down showing spoilage
5. **Intermediate Units** (2.5s) — bars at post-spoilage levels
6. **Production** (1.0s) — bars animate UP showing production gains
7. **Result Units** (4.0s) — final amounts displayed
8. **End** (5.0s) — pause before phase advances

**Layout (from Java spec):**
- 4 player bars side by side per resource
- Bar width: 21px
- Bar height: units * 6px (max 159px)
- Bar color: player color (bright fill, dark border)
- Critical level line: red dashed line
- Title: "[Resource] for Round [N]" colored by resource
- Animation speed: 25px/sec

**Resource cycling:** The collection scene runs once per resource in AUCTION_RESOURCE_ORDER. Each run shows that resource's bars for all 4 players.

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/scenes/CollectionScene.ts
git commit -m "feat(client): 8-stage animated collection bars per Java reference"
```

---

### Task 7: Rewrite SummaryScene — Walking Lineup

**Files:**
- Rewrite: `packages/client/src/scenes/SummaryScene.ts`

Summary shows players walking from right to left into a lineup sorted by rank, then displays a score table.

- [ ] **Step 1: Rewrite SummaryScene**

**Phase 1: Walking animation**
- 4 player sprites start at x=650+110*idx, y=285
- Walk left to lineup positions: x=55, y=95+46*idx (sorted by rank)
- Speed: 120px/sec
- Walking direction: West

**Phase 2: Score table (after animation completes)**
- Column headers: Name, Money, Plots, Assets, Total
- X positions: 55, 208, 313, 418, 523
- Row Y: 126 + rank*41
- Text: monospace, player-colored, right-aligned numbers
- Colony rating below table
- Game over: "GAME OVER" header with winner highlight

**Controls:**
- SPACE or click to skip animation → jump to score table
- After score display, auto-advance (server handles phase transition)

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/scenes/SummaryScene.ts
git commit -m "feat(client): walking lineup summary with score table"
```

---

### Task 8: IntroScene + TileRenderer Updates

**Files:**
- Create: `packages/client/src/scenes/IntroScene.ts`
- Modify: `packages/client/src/ui/TileRenderer.ts`
- Modify: `packages/client/src/main.ts`

- [ ] **Step 1: Create IntroScene**

Create `packages/client/src/scenes/IntroScene.ts`:
- Display "M.U.L.E." title text, round number
- Show player names and colors
- Auto-advance after 3 seconds (matching server intro phase timer)
- On first round: "WELCOME TO PLANET IRATA" message

- [ ] **Step 2: Update TileRenderer**

Modify `packages/client/src/ui/TileRenderer.ts`:
- Add SmallWater terrain color: `small_water: 0x6ab4d9`
- Add crystite level indicator: small colored dot on tiles with crystite (only if crystiteRevealed or owner has assayed)
- Add smithore level indicator: 1-4 small marks on mountain tiles
- Add wampus blinking: flashing red "W" text on wampus tile (1.2s visible, 0.4s hidden cycle)

- [ ] **Step 3: Update main.ts**

Add IntroScene to imports and scene array. Remove TownScene import.

- [ ] **Step 4: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/scenes/IntroScene.ts packages/client/src/ui/TileRenderer.ts packages/client/src/main.ts
git commit -m "feat(client): intro scene, tile renderer with crystite/smithore/wampus indicators"
```

---

### Task 9: GameClient Message Updates

**Files:**
- Modify: `packages/client/src/network/GameClient.ts`

- [ ] **Step 1: Add missing message methods**

Read `packages/client/src/network/GameClient.ts` and add methods for any missing server messages:
- `assay()` — sends "assay" message
- `sellPlot(row, col)` — sends "sell_plot" with {row, col}
- `catchWampus()` — sends "catch_wampus"

Follow the existing pattern for how messages are sent.

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/mule-game && pnpm --filter @mule-game/client build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/network/GameClient.ts
git commit -m "feat(client): add assay, sell_plot, catch_wampus message methods"
```

---

### Task 10: Integration Test — Full Game Client Build

**Files:**
- All client files

- [ ] **Step 1: Full build**

```bash
cd ~/mule-game && pnpm --filter @mule-game/shared build && pnpm --filter @mule-game/client build
```

Fix any remaining type errors.

- [ ] **Step 2: Run server + client and verify**

```bash
# Terminal 1: Start server
cd ~/mule-game/packages/server && npx tsx --import ./polyfill.mjs src/index.ts

# Terminal 2: Start client dev server
cd ~/mule-game/packages/client && npx vite --port 3000
```

Verify: open http://localhost:2567, create game, confirm:
- Intro scene shows briefly
- Land grant cursor scans, SPACE claims
- Development: avatar appears, arrow keys move, walking into town works
- Town: buildings visible, B/1-4/P/ESC work
- Auction: vertical bar, UP/DOWN moves position
- Collection: animated bars show
- Summary: players walk into lineup

- [ ] **Step 3: Run play-full.mjs to verify networked game still works**

```bash
cd ~/mule-game/packages/client && node play-full.mjs
```

Verify 12-round game completes with phase transitions logged.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(client): complete UI rework — avatar movement, walk-in town, animated collection, auction bar"
```
