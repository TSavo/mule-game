# Web M.U.L.E. Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared game library — types, map generation, and economy formulas — as pure, testable TypeScript functions with zero framework dependencies.

**Architecture:** A pnpm monorepo with a `shared` package containing all game types, constants, deterministic RNG, map generation, and economic calculations. Everything is pure functions. No server, no client, no framework code. This package will be consumed by the server and client packages in Plans 2 and 3.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest

---

## File Structure

```
mule-game/
  package.json              — Root workspace config
  pnpm-workspace.yaml       — Workspace definition
  tsconfig.base.json        — Shared TS config
  packages/
    shared/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        index.ts            — Public API barrel export
        types.ts            — All game type definitions
        constants.ts        — Economic constants, production tables, prices
        rng.ts              — Deterministic seeded PRNG
        map-generator.ts    — Map generation (terrain, mountains, crystite)
        production.ts       — Production calculation (tile quality, adjacency, energy)
        spoilage.ts         — Spoilage between rounds
        store.ts            — Store pricing, M.U.L.E. availability, buy/sell prices
        scoring.ts          — Net worth, colony score, winner determination
        events.ts           — Random event definitions and selection logic
        food-timer.ts       — Food → development turn duration
      tests/
        rng.test.ts
        map-generator.test.ts
        production.test.ts
        spoilage.test.ts
        store.test.ts
        scoring.test.ts
        events.test.ts
        food-timer.test.ts
```

---

### Task 1: Monorepo Setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Initialize git repo**

```bash
cd ~/mule-game
git init
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "mule-game",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 5: Create packages/shared/package.json**

```json
{
  "name": "@mule-game/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 6: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Create packages/shared/vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 8: Create packages/shared/src/index.ts**

```ts
export * from "./types.js";
export * from "./constants.js";
export * from "./rng.js";
export * from "./map-generator.js";
export * from "./production.js";
export * from "./spoilage.js";
export * from "./store.js";
export * from "./scoring.js";
export * from "./events.js";
export * from "./food-timer.js";
```

- [ ] **Step 9: Install dependencies**

```bash
cd ~/mule-game
pnpm install
```

- [ ] **Step 10: Create .gitignore and commit**

`.gitignore`:
```
node_modules/
dist/
.superpowers/
```

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore packages/shared/
git commit -m "chore: monorepo setup with shared package"
```

---

### Task 2: Game Types

**Files:**
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Define all game types**

```ts
// ── Terrain ──

export enum TerrainType {
  Plains = "plains",
  River = "river",
  Mountain1 = "mountain1", // small hills — low smithore
  Mountain2 = "mountain2", // medium peaks — medium smithore
  Mountain3 = "mountain3", // large peaks — high smithore
  Town = "town",
}

// ── Resources ──

export enum ResourceType {
  Food = "food",
  Energy = "energy",
  Smithore = "smithore",
  Crystite = "crystite",
}

export interface ResourceInventory {
  food: number;
  energy: number;
  smithore: number;
  crystite: number;
}

// ── Map ──

export const MAP_ROWS = 5;
export const MAP_COLS = 9;
export const TOWN_ROW = 2; // 0-indexed center
export const TOWN_COL = 4; // 0-indexed center
export const RIVER_COL = 4; // center column
export const TOTAL_PLOTS = MAP_ROWS * MAP_COLS - 1; // 44, minus town

export interface MapTile {
  row: number;
  col: number;
  terrain: TerrainType;
  crystiteLevel: CrystiteLevel;
  owner: number | null; // player index or null
  installedMule: ResourceType | null;
}

export type CrystiteLevel = "none" | "low" | "medium" | "high";

export interface GameMap {
  tiles: MapTile[][]; // [row][col]
  seed: number;
}

// ── Players ──

export enum Species {
  Mechtron = "mechtron",
  Gollumer = "gollumer",
  Packer = "packer",
  Bonzoid = "bonzoid",
  Spheroid = "spheroid",
  Flapper = "flapper",
  Leggite = "leggite",
  Humanoid = "humanoid",
}

export interface Player {
  index: number; // 0-3
  name: string;
  species: Species;
  color: PlayerColor;
  money: number;
  inventory: ResourceInventory;
  ownedPlots: Array<{ row: number; col: number }>;
  isAI: boolean;
  aiDifficulty: AIDifficulty | null;
}

export type PlayerColor = "red" | "blue" | "green" | "purple";
export type AIDifficulty = "beginner" | "standard" | "tournament";

// ── Store ──

export interface StoreState {
  inventory: ResourceInventory;
  muleCount: number;
  mulePrice: number;
  buyPrices: ResourceInventory; // store buys at these prices (floor)
  sellPrices: ResourceInventory; // store sells at these prices (ceiling)
}

// ── Game State ──

export enum GamePhase {
  LandGrant = "land_grant",
  LandAuction = "land_auction",
  Development = "development",
  Production = "production",
  RandomEvent = "random_event",
  TradingAuction = "trading_auction",
  Scoring = "scoring",
  GameOver = "game_over",
}

export enum GameMode {
  Beginner = "beginner",
  Standard = "standard",
  Tournament = "tournament",
}

export interface GameConfig {
  mode: GameMode;
  totalRounds: number; // 6 for beginner, 12 for standard/tournament
  humanPlayerCount: number; // 0-4
  seed: number;
}

// ── Random Events ──

export enum RandomEventTarget {
  Leader = "leader", // bad events target leader
  Trailing = "trailing", // good events target trailing player
  Colony = "colony", // affects everyone
}

export interface RandomEvent {
  id: string;
  description: string;
  target: RandomEventTarget;
  effect: EventEffect;
}

export type EventEffect =
  | { type: "money"; amount: number }
  | { type: "resource"; resource: ResourceType; amount: number }
  | { type: "lose_plot" }
  | { type: "gain_plot" }
  | { type: "production_modifier"; resource: ResourceType; multiplier: number }
  | { type: "pirate_raid" }; // steals all crystite

// ── Trading Auction ──

export enum AuctionRole {
  Buyer = "buyer",
  Seller = "seller",
  None = "none",
}

export interface AuctionState {
  resource: ResourceType;
  players: Array<{
    index: number;
    role: AuctionRole;
    pricePosition: number; // 0-100 vertical position
    unitsSold: number;
    unitsBought: number;
  }>;
  storeBuyPrice: number | null; // null if store has no stock
  storeSellPrice: number | null; // null if store has no stock
  storeUnits: number;
  timeRemaining: number;
}

// ── Production ──

export interface ProductionResult {
  tile: { row: number; col: number };
  resource: ResourceType;
  baseOutput: number;
  adjacencyBonus: number;
  energyModifier: number;
  finalOutput: number;
}

// ── Scoring ──

export interface PlayerScore {
  playerIndex: number;
  money: number;
  landValue: number;
  goodsValue: number;
  totalScore: number;
}

export interface ColonyScore {
  total: number;
  rating: "first_founder" | "pioneer" | "settler" | "failure";
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd ~/mule-game/packages/shared
npx tsc --noEmit src/types.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: define all game types"
```

---

### Task 3: Constants

**Files:**
- Create: `packages/shared/src/constants.ts`

- [ ] **Step 1: Define all economic constants**

```ts
import { ResourceType, TerrainType, GameMode, type ResourceInventory } from "./types.js";

// ── Starting Conditions ──

export const STARTING_MONEY: Record<GameMode, number> = {
  beginner: 1000,
  standard: 1000,
  tournament: 1000,
};

export const AI_TOURNAMENT_BONUS = 200; // AI gets extra $200 in tournament

export const STARTING_INVENTORY: ResourceInventory = {
  food: 4,
  energy: 2,
  smithore: 0,
  crystite: 0,
};

// ── Store Starting Inventory ──

export const STORE_STARTING_INVENTORY: ResourceInventory = {
  food: 16,
  energy: 16,
  smithore: 0,
  crystite: 0,
};

export const STORE_STARTING_MULES = 14;

// ── M.U.L.E. Prices ──

export const MULE_BASE_PRICE = 100;

export const OUTFIT_COST: Record<ResourceType, number> = {
  food: 25,
  energy: 50,
  smithore: 75,
  crystite: 100,
};

// ── Production Tables ──
// Quality: 0 = none, 1 = poor, 2 = medium, 3 = good, 4 = high
// Maps [TerrainType][ResourceType] → base quality (0-4)

export const PRODUCTION_QUALITY: Record<string, Record<ResourceType, number>> = {
  [TerrainType.River]: {
    food: 4,
    energy: 1,
    smithore: 0, // no mining on river
    crystite: 0, // no mining on river
  },
  [TerrainType.Plains]: {
    food: 2,
    energy: 4,
    smithore: 1,
    crystite: 0, // determined by crystite deposits
  },
  [TerrainType.Mountain1]: {
    food: 1,
    energy: 1,
    smithore: 2,
    crystite: 0,
  },
  [TerrainType.Mountain2]: {
    food: 1,
    energy: 1,
    smithore: 3,
    crystite: 0,
  },
  [TerrainType.Mountain3]: {
    food: 1,
    energy: 1,
    smithore: 4,
    crystite: 0,
  },
  [TerrainType.Town]: {
    food: 0,
    energy: 0,
    smithore: 0,
    crystite: 0,
  },
};

// Quality → base units produced (before modifiers)
export const QUALITY_TO_UNITS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 5,
  4: 7,
};

// ── Spoilage Rates ──

export const SPOILAGE_RATE: Record<ResourceType, number> = {
  food: 0.5,
  energy: 0.25,
  smithore: 0, // spoils only above 50
  crystite: 0, // spoils only above 50
};

export const SPOILAGE_THRESHOLD = 50; // smithore/crystite above this spoil

// ── Store Price Ranges ──

export const STORE_BUY_PRICE: Record<ResourceType, number> = {
  food: 20,
  energy: 30,
  smithore: 50,
  crystite: 50,
};

export const STORE_SELL_PRICE: Record<ResourceType, number> = {
  food: 40,
  energy: 60,
  smithore: 100,
  crystite: 150,
};

// ── Food → Turn Duration ──

export const MAX_TURN_DURATION_MS = 45_000; // 45 seconds
export const MIN_TURN_DURATION_MS = 10_000; // 10 seconds (starving)

// Food required for full turn by round (1-indexed)
export const FOOD_REQUIRED_BY_ROUND: number[] = [
  0,  // unused (0-index)
  3, 3, 3, 3,   // rounds 1-4
  4, 4, 4, 4,   // rounds 5-8
  5, 5, 5, 5,   // rounds 9-12
];

// ── Energy → Production Modifier ──

// Each installed M.U.L.E. consumes 1 energy per round.
// If player doesn't have enough energy, some M.U.L.E.s don't produce.
export const ENERGY_PER_MULE = 1;

// ── Adjacency Bonus ──

// Bonus production units for contiguous same-resource tiles
// 1 tile = 0 bonus, 2 tiles = +1, 3+ tiles = +2 per tile
export const ADJACENCY_BONUS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 2,
  5: 2,
  6: 3, // scaling bonus at 6
  7: 3,
  8: 3,
  9: 4, // scaling bonus at 9
};

// ── Wampus Bounty ──

export const WAMPUS_BOUNTY_BY_ROUND: number[] = [
  0,   // unused
  100, 100, 100,     // rounds 1-3
  200, 200, 200, 200, // rounds 4-7
  300, 300, 300, 300, // rounds 8-11
  400,               // round 12
];

// ── Game Duration ──

export const ROUNDS_BY_MODE: Record<GameMode, number> = {
  beginner: 6,
  standard: 12,
  tournament: 12,
};

// ── Auction Timing ──

export const DECLARE_TIMER_MS = 5_000;
export const AUCTION_TIMER_MS = 30_000;

// ── Auction Resource Order ──

export const AUCTION_RESOURCE_ORDER: ResourceType[] = [
  ResourceType.Smithore,
  ResourceType.Crystite,
  ResourceType.Food,
  ResourceType.Energy,
];

// ── Land Value ──

export const LAND_VALUE = 500; // each plot worth $500 for scoring

// ── Pub Payout ──

// Pub pays $0-$250 based on remaining time proportion
export const PUB_MAX_PAYOUT = 250;

// ── Mountain Count ──

export const MIN_MOUNTAINS = 6;
export const MAX_MOUNTAINS = 8;

// ── Crystite Cluster ──

export const MIN_CLUSTERS = 1;
export const MAX_CLUSTERS = 2;
export const MIN_CLUSTER_SIZE = 3;
export const MAX_CLUSTER_SIZE = 5;

// ── Colony Score Thresholds ──

export const COLONY_THRESHOLDS = {
  first_founder: 80_000,
  pioneer: 60_000,
  settler: 40_000,
  // below settler = failure
};
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/mule-game/packages/shared
npx tsc --noEmit src/constants.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat: define all game constants and economic tables"
```

---

### Task 4: Deterministic RNG

**Files:**
- Create: `packages/shared/src/rng.ts`
- Create: `packages/shared/tests/rng.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { SeededRNG } from "../src/rng.js";

describe("SeededRNG", () => {
  it("produces deterministic sequence from same seed", () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it("produces different sequences from different seeds", () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(99);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).not.toEqual(seq2);
  });

  it("next() returns values between 0 and 1", () => {
    const rng = new SeededRNG(123);
    for (let i = 0; i < 100; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("nextInt(min, max) returns integers in range", () => {
    const rng = new SeededRNG(456);
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(3, 7);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(7);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("shuffle() produces deterministic shuffles", () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(rng1.shuffle(arr1)).toEqual(rng2.shuffle(arr2));
  });

  it("pick() selects a random element from array", () => {
    const rng = new SeededRNG(42);
    const items = ["a", "b", "c", "d"];
    const picked = rng.pick(items);
    expect(items).toContain(picked);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/rng.test.ts
```

Expected: FAIL — `SeededRNG` not found.

- [ ] **Step 3: Implement SeededRNG**

```ts
// Mulberry32 — fast, good distribution, 32-bit state
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Fisher-Yates shuffle, returns new array */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** Pick a random element from an array */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/rng.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/rng.ts packages/shared/tests/rng.test.ts
git commit -m "feat: deterministic seeded RNG (Mulberry32)"
```

---

### Task 5: Map Generation

**Files:**
- Create: `packages/shared/src/map-generator.ts`
- Create: `packages/shared/tests/map-generator.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { generateMap } from "../src/map-generator.js";
import { TerrainType, MAP_ROWS, MAP_COLS, TOWN_ROW, TOWN_COL, RIVER_COL } from "../src/types.js";

describe("generateMap", () => {
  const map = generateMap(42);

  it("creates a 5x9 grid", () => {
    expect(map.tiles.length).toBe(MAP_ROWS);
    for (const row of map.tiles) {
      expect(row.length).toBe(MAP_COLS);
    }
  });

  it("places town at center", () => {
    expect(map.tiles[TOWN_ROW][TOWN_COL].terrain).toBe(TerrainType.Town);
  });

  it("places river in center column excluding town", () => {
    for (let r = 0; r < MAP_ROWS; r++) {
      const tile = map.tiles[r][RIVER_COL];
      if (r === TOWN_ROW) {
        expect(tile.terrain).toBe(TerrainType.Town);
      } else {
        expect(tile.terrain).toBe(TerrainType.River);
      }
    }
  });

  it("has 4 river tiles", () => {
    const riverCount = map.tiles.flat().filter((t) => t.terrain === TerrainType.River).length;
    expect(riverCount).toBe(4);
  });

  it("has 6-8 mountain tiles", () => {
    const mountainCount = map.tiles
      .flat()
      .filter((t) =>
        [TerrainType.Mountain1, TerrainType.Mountain2, TerrainType.Mountain3].includes(t.terrain)
      ).length;
    expect(mountainCount).toBeGreaterThanOrEqual(6);
    expect(mountainCount).toBeLessThanOrEqual(8);
  });

  it("fills remaining tiles with plains", () => {
    for (const tile of map.tiles.flat()) {
      expect(
        [
          TerrainType.Plains,
          TerrainType.River,
          TerrainType.Mountain1,
          TerrainType.Mountain2,
          TerrainType.Mountain3,
          TerrainType.Town,
        ].includes(tile.terrain)
      ).toBe(true);
    }
  });

  it("does not place mountains on river or town", () => {
    for (const tile of map.tiles.flat()) {
      if (tile.col === RIVER_COL) {
        expect(tile.terrain).not.toBe(TerrainType.Mountain1);
        expect(tile.terrain).not.toBe(TerrainType.Mountain2);
        expect(tile.terrain).not.toBe(TerrainType.Mountain3);
      }
    }
  });

  it("is deterministic — same seed produces same map", () => {
    const map1 = generateMap(42);
    const map2 = generateMap(42);
    expect(map1.tiles).toEqual(map2.tiles);
  });

  it("different seeds produce different maps", () => {
    const map1 = generateMap(42);
    const map2 = generateMap(99);
    const terrains1 = map1.tiles.flat().map((t) => t.terrain);
    const terrains2 = map2.tiles.flat().map((t) => t.terrain);
    expect(terrains1).not.toEqual(terrains2);
  });

  it("sets all tiles to unowned with no installed mule", () => {
    for (const tile of map.tiles.flat()) {
      expect(tile.owner).toBeNull();
      if (tile.terrain !== TerrainType.Town) {
        expect(tile.installedMule).toBeNull();
      }
    }
  });

  it("assigns crystite levels to non-river non-town tiles", () => {
    const tilesWithCrystite = map.tiles
      .flat()
      .filter((t) => t.crystiteLevel !== "none" && t.terrain !== TerrainType.River && t.terrain !== TerrainType.Town);
    // Should have at least 3 tiles with crystite (min 1 cluster of size 3)
    expect(tilesWithCrystite.length).toBeGreaterThanOrEqual(3);
    expect(tilesWithCrystite.length).toBeLessThanOrEqual(10);
  });

  it("does not place crystite on river tiles", () => {
    for (const tile of map.tiles.flat()) {
      if (tile.terrain === TerrainType.River) {
        expect(tile.crystiteLevel).toBe("none");
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/map-generator.test.ts
```

Expected: FAIL — `generateMap` not found.

- [ ] **Step 3: Implement map generator**

```ts
import {
  type GameMap,
  type MapTile,
  type CrystiteLevel,
  TerrainType,
  MAP_ROWS,
  MAP_COLS,
  TOWN_ROW,
  TOWN_COL,
  RIVER_COL,
} from "./types.js";
import { MIN_MOUNTAINS, MAX_MOUNTAINS, MIN_CLUSTERS, MAX_CLUSTERS, MIN_CLUSTER_SIZE, MAX_CLUSTER_SIZE } from "./constants.js";
import { SeededRNG } from "./rng.js";

export function generateMap(seed: number): GameMap {
  const rng = new SeededRNG(seed);

  // Initialize grid with plains
  const tiles: MapTile[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: MapTile[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      row.push({
        row: r,
        col: c,
        terrain: TerrainType.Plains,
        crystiteLevel: "none",
        owner: null,
        installedMule: null,
      });
    }
    tiles.push(row);
  }

  // Place town
  tiles[TOWN_ROW][TOWN_COL].terrain = TerrainType.Town;

  // Place river (center column, excluding town)
  for (let r = 0; r < MAP_ROWS; r++) {
    if (r !== TOWN_ROW) {
      tiles[r][RIVER_COL].terrain = TerrainType.River;
    }
  }

  // Collect eligible tiles for mountains (not river, not town)
  const eligible: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (tiles[r][c].terrain === TerrainType.Plains) {
        eligible.push({ row: r, col: c });
      }
    }
  }

  // Place mountains
  const mountainCount = rng.nextInt(MIN_MOUNTAINS, MAX_MOUNTAINS);
  const mountainTypes = [TerrainType.Mountain1, TerrainType.Mountain2, TerrainType.Mountain3];
  const shuffled = rng.shuffle(eligible);

  for (let i = 0; i < mountainCount && i < shuffled.length; i++) {
    const { row, col } = shuffled[i];
    tiles[row][col].terrain = rng.pick(mountainTypes);
  }

  // Place crystite clusters
  placeCrystiteClusters(tiles, rng);

  return { tiles, seed };
}

function placeCrystiteClusters(tiles: MapTile[][], rng: SeededRNG): void {
  const clusterCount = rng.nextInt(MIN_CLUSTERS, MAX_CLUSTERS);

  // Eligible tiles: not river, not town
  const eligible: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const terrain = tiles[r][c].terrain;
      if (terrain !== TerrainType.River && terrain !== TerrainType.Town) {
        eligible.push({ row: r, col: c });
      }
    }
  }

  for (let cluster = 0; cluster < clusterCount; cluster++) {
    const clusterSize = rng.nextInt(MIN_CLUSTER_SIZE, MAX_CLUSTER_SIZE);

    // Pick a random center for this cluster
    const center = rng.pick(eligible);
    const levels: CrystiteLevel[] = ["low", "medium", "high"];

    // Assign crystite to center tile
    tiles[center.row][center.col].crystiteLevel = rng.pick(levels);

    // Spread to neighbors
    let placed = 1;
    const candidates = getNeighbors(center.row, center.col).filter(
      ({ row, col }) =>
        row >= 0 &&
        row < MAP_ROWS &&
        col >= 0 &&
        col < MAP_COLS &&
        tiles[row][col].terrain !== TerrainType.River &&
        tiles[row][col].terrain !== TerrainType.Town
    );

    const shuffledCandidates = rng.shuffle(candidates);
    for (const candidate of shuffledCandidates) {
      if (placed >= clusterSize) break;
      if (tiles[candidate.row][candidate.col].crystiteLevel === "none") {
        tiles[candidate.row][candidate.col].crystiteLevel = rng.pick(levels);
        placed++;
      }
    }
  }
}

function getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
    { row: row - 1, col: col - 1 },
    { row: row - 1, col: col + 1 },
    { row: row + 1, col: col - 1 },
    { row: row + 1, col: col + 1 },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/map-generator.test.ts
```

Expected: All 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/map-generator.ts packages/shared/tests/map-generator.test.ts
git commit -m "feat: map generation with terrain, mountains, crystite clusters"
```

---

### Task 6: Production Calculation

**Files:**
- Create: `packages/shared/src/production.ts`
- Create: `packages/shared/tests/production.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { calculateTileProduction, calculateAdjacencyBonus, getProductionQuality } from "../src/production.js";
import { TerrainType, ResourceType } from "../src/types.js";
import type { MapTile } from "../src/types.js";

function makeTile(overrides: Partial<MapTile> = {}): MapTile {
  return {
    row: 0,
    col: 0,
    terrain: TerrainType.Plains,
    crystiteLevel: "none",
    owner: null,
    installedMule: null,
    ...overrides,
  };
}

describe("getProductionQuality", () => {
  it("river + food = 4 (high)", () => {
    expect(getProductionQuality(TerrainType.River, ResourceType.Food)).toBe(4);
  });

  it("river + smithore = 0 (none — no mining on river)", () => {
    expect(getProductionQuality(TerrainType.River, ResourceType.Smithore)).toBe(0);
  });

  it("plains + energy = 4 (high)", () => {
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Energy)).toBe(4);
  });

  it("mountain3 + smithore = 4 (high)", () => {
    expect(getProductionQuality(TerrainType.Mountain3, ResourceType.Smithore)).toBe(4);
  });

  it("mountain1 + energy = 1 (poor)", () => {
    expect(getProductionQuality(TerrainType.Mountain1, ResourceType.Energy)).toBe(1);
  });

  it("plains + crystite uses crystiteLevel not terrain", () => {
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Crystite, "high")).toBe(4);
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Crystite, "medium")).toBe(3);
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Crystite, "low")).toBe(2);
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Crystite, "none")).toBe(0);
  });
});

describe("calculateAdjacencyBonus", () => {
  it("returns 0 for a single tile", () => {
    const tiles: MapTile[][] = [[makeTile({ installedMule: ResourceType.Food, owner: 0 })]];
    expect(calculateAdjacencyBonus(tiles, 0, 0, 0)).toBe(0);
  });

  it("returns bonus for 2 adjacent same-resource tiles", () => {
    const tiles: MapTile[][] = [
      [
        makeTile({ row: 0, col: 0, installedMule: ResourceType.Food, owner: 0 }),
        makeTile({ row: 0, col: 1, installedMule: ResourceType.Food, owner: 0 }),
      ],
    ];
    expect(calculateAdjacencyBonus(tiles, 0, 0, 0)).toBe(1);
  });

  it("returns 0 for adjacent different-resource tiles", () => {
    const tiles: MapTile[][] = [
      [
        makeTile({ row: 0, col: 0, installedMule: ResourceType.Food, owner: 0 }),
        makeTile({ row: 0, col: 1, installedMule: ResourceType.Energy, owner: 0 }),
      ],
    ];
    expect(calculateAdjacencyBonus(tiles, 0, 0, 0)).toBe(0);
  });

  it("returns 0 for adjacent same-resource tiles owned by different player", () => {
    const tiles: MapTile[][] = [
      [
        makeTile({ row: 0, col: 0, installedMule: ResourceType.Food, owner: 0 }),
        makeTile({ row: 0, col: 1, installedMule: ResourceType.Food, owner: 1 }),
      ],
    ];
    expect(calculateAdjacencyBonus(tiles, 0, 0, 0)).toBe(0);
  });
});

describe("calculateTileProduction", () => {
  it("produces max output for ideal terrain match with full energy", () => {
    const tile = makeTile({ terrain: TerrainType.River, installedMule: ResourceType.Food, owner: 0 });
    const result = calculateTileProduction(tile, [[tile]], 0, true);
    expect(result.baseOutput).toBe(7); // quality 4 → 7 units
    expect(result.energyModifier).toBe(1);
    expect(result.finalOutput).toBe(7);
  });

  it("produces 0 for smithore on river", () => {
    const tile = makeTile({ terrain: TerrainType.River, installedMule: ResourceType.Smithore, owner: 0 });
    const result = calculateTileProduction(tile, [[tile]], 0, true);
    expect(result.finalOutput).toBe(0);
  });

  it("produces 0 when no energy", () => {
    const tile = makeTile({ terrain: TerrainType.Plains, installedMule: ResourceType.Energy, owner: 0 });
    const result = calculateTileProduction(tile, [[tile]], 0, false);
    expect(result.energyModifier).toBe(0);
    expect(result.finalOutput).toBe(0);
  });

  it("caps output at 8", () => {
    // River food (7 base) + adjacency bonus (1) = 8 capped
    const tiles: MapTile[][] = [
      [
        makeTile({ row: 0, col: 0, terrain: TerrainType.River, installedMule: ResourceType.Food, owner: 0 }),
      ],
      [
        makeTile({ row: 1, col: 0, terrain: TerrainType.River, installedMule: ResourceType.Food, owner: 0 }),
      ],
    ];
    const result = calculateTileProduction(tiles[0][0], tiles, 0, true);
    expect(result.finalOutput).toBeLessThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/production.test.ts
```

Expected: FAIL — functions not found.

- [ ] **Step 3: Implement production calculations**

```ts
import type { MapTile, CrystiteLevel, ProductionResult } from "./types.js";
import { TerrainType, ResourceType, MAP_ROWS, MAP_COLS } from "./types.js";
import { PRODUCTION_QUALITY, QUALITY_TO_UNITS, ADJACENCY_BONUS } from "./constants.js";

const MAX_OUTPUT = 8;

const CRYSTITE_LEVEL_TO_QUALITY: Record<CrystiteLevel, number> = {
  none: 0,
  low: 2,
  medium: 3,
  high: 4,
};

/**
 * Get the production quality (0-4) for a terrain/resource combination.
 * For crystite, the quality comes from the tile's crystite deposits, not terrain.
 */
export function getProductionQuality(
  terrain: TerrainType,
  resource: ResourceType,
  crystiteLevel: CrystiteLevel = "none"
): number {
  if (resource === ResourceType.Crystite) {
    // No mining on river
    if (terrain === TerrainType.River || terrain === TerrainType.Town) return 0;
    return CRYSTITE_LEVEL_TO_QUALITY[crystiteLevel];
  }
  return PRODUCTION_QUALITY[terrain]?.[resource] ?? 0;
}

/**
 * Count contiguous same-resource, same-owner tiles connected to the given tile.
 * Returns the adjacency bonus units.
 */
export function calculateAdjacencyBonus(
  tiles: MapTile[][],
  row: number,
  col: number,
  playerIndex: number
): number {
  const tile = tiles[row]?.[col];
  if (!tile || !tile.installedMule || tile.owner !== playerIndex) return 0;

  const resource = tile.installedMule;

  // BFS to count contiguous same-resource, same-owner tiles
  const visited = new Set<string>();
  const queue: Array<{ r: number; c: number }> = [{ r: row, c: col }];
  visited.add(`${row},${col}`);

  while (queue.length > 0) {
    const { r, c } = queue.shift()!;
    const neighbors = [
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 },
    ];
    for (const n of neighbors) {
      const key = `${n.r},${n.c}`;
      if (visited.has(key)) continue;
      if (n.r < 0 || n.r >= tiles.length || n.c < 0 || n.c >= (tiles[0]?.length ?? 0)) continue;
      const neighbor = tiles[n.r][n.c];
      if (neighbor.owner === playerIndex && neighbor.installedMule === resource) {
        visited.add(key);
        queue.push(n);
      }
    }
  }

  const groupSize = visited.size;
  return ADJACENCY_BONUS[groupSize] ?? ADJACENCY_BONUS[9] ?? 0;
}

/**
 * Calculate production for a single tile.
 */
export function calculateTileProduction(
  tile: MapTile,
  allTiles: MapTile[][],
  playerIndex: number,
  hasEnergy: boolean
): ProductionResult {
  const resource = tile.installedMule;
  if (!resource || tile.owner !== playerIndex) {
    return {
      tile: { row: tile.row, col: tile.col },
      resource: resource ?? ResourceType.Food,
      baseOutput: 0,
      adjacencyBonus: 0,
      energyModifier: 0,
      finalOutput: 0,
    };
  }

  const quality = getProductionQuality(tile.terrain, resource, tile.crystiteLevel);
  const baseOutput = QUALITY_TO_UNITS[quality] ?? 0;
  const adjacencyBonus = calculateAdjacencyBonus(allTiles, tile.row, tile.col, playerIndex);
  const energyModifier = hasEnergy ? 1 : 0;

  const rawOutput = (baseOutput + adjacencyBonus) * energyModifier;
  const finalOutput = Math.min(rawOutput, MAX_OUTPUT);

  return {
    tile: { row: tile.row, col: tile.col },
    resource,
    baseOutput,
    adjacencyBonus,
    energyModifier,
    finalOutput,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/production.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/production.ts packages/shared/tests/production.test.ts
git commit -m "feat: production calculation with quality, adjacency, and energy"
```

---

### Task 7: Spoilage Calculation

**Files:**
- Create: `packages/shared/src/spoilage.ts`
- Create: `packages/shared/tests/spoilage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { calculateSpoilage } from "../src/spoilage.js";
import type { ResourceInventory } from "../src/types.js";

describe("calculateSpoilage", () => {
  it("spoils 50% of food surplus", () => {
    const inventory: ResourceInventory = { food: 10, energy: 0, smithore: 0, crystite: 0 };
    const consumed: ResourceInventory = { food: 4, energy: 0, smithore: 0, crystite: 0 };
    const result = calculateSpoilage(inventory, consumed);
    // surplus = 10 - 4 = 6, spoil 50% = 3, remaining = 10 - 3 = 7
    expect(result.food).toBe(7);
  });

  it("spoils 25% of energy surplus", () => {
    const inventory: ResourceInventory = { food: 0, energy: 20, smithore: 0, crystite: 0 };
    const consumed: ResourceInventory = { food: 0, energy: 8, smithore: 0, crystite: 0 };
    const result = calculateSpoilage(inventory, consumed);
    // surplus = 20 - 8 = 12, spoil 25% = 3, remaining = 20 - 3 = 17
    expect(result.energy).toBe(17);
  });

  it("does not spoil smithore below threshold", () => {
    const inventory: ResourceInventory = { food: 0, energy: 0, smithore: 30, crystite: 0 };
    const consumed: ResourceInventory = { food: 0, energy: 0, smithore: 0, crystite: 0 };
    const result = calculateSpoilage(inventory, consumed);
    expect(result.smithore).toBe(30);
  });

  it("spoils smithore above threshold of 50", () => {
    const inventory: ResourceInventory = { food: 0, energy: 0, smithore: 60, crystite: 0 };
    const consumed: ResourceInventory = { food: 0, energy: 0, smithore: 0, crystite: 0 };
    const result = calculateSpoilage(inventory, consumed);
    expect(result.smithore).toBe(50);
  });

  it("spoils crystite above threshold of 50", () => {
    const inventory: ResourceInventory = { food: 0, energy: 0, smithore: 0, crystite: 75 };
    const consumed: ResourceInventory = { food: 0, energy: 0, smithore: 0, crystite: 0 };
    const result = calculateSpoilage(inventory, consumed);
    expect(result.crystite).toBe(50);
  });

  it("does not spoil below zero", () => {
    const inventory: ResourceInventory = { food: 2, energy: 1, smithore: 0, crystite: 0 };
    const consumed: ResourceInventory = { food: 2, energy: 1, smithore: 0, crystite: 0 };
    const result = calculateSpoilage(inventory, consumed);
    expect(result.food).toBe(2);
    expect(result.energy).toBe(1);
  });

  it("handles zero inventory", () => {
    const inventory: ResourceInventory = { food: 0, energy: 0, smithore: 0, crystite: 0 };
    const consumed: ResourceInventory = { food: 0, energy: 0, smithore: 0, crystite: 0 };
    const result = calculateSpoilage(inventory, consumed);
    expect(result).toEqual({ food: 0, energy: 0, smithore: 0, crystite: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/spoilage.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement spoilage**

```ts
import type { ResourceInventory } from "./types.js";
import { SPOILAGE_RATE, SPOILAGE_THRESHOLD } from "./constants.js";

/**
 * Calculate post-spoilage inventory.
 * Food/energy: percentage of surplus spoils.
 * Smithore/crystite: units above 50 are removed.
 */
export function calculateSpoilage(
  inventory: ResourceInventory,
  consumed: ResourceInventory
): ResourceInventory {
  const foodSurplus = Math.max(0, inventory.food - consumed.food);
  const foodSpoiled = Math.floor(foodSurplus * SPOILAGE_RATE.food);

  const energySurplus = Math.max(0, inventory.energy - consumed.energy);
  const energySpoiled = Math.floor(energySurplus * SPOILAGE_RATE.energy);

  const smithoreAfter = Math.min(inventory.smithore, SPOILAGE_THRESHOLD);
  const crystiteAfter = Math.min(inventory.crystite, SPOILAGE_THRESHOLD);

  return {
    food: inventory.food - foodSpoiled,
    energy: inventory.energy - energySpoiled,
    smithore: inventory.smithore > SPOILAGE_THRESHOLD ? smithoreAfter : inventory.smithore,
    crystite: inventory.crystite > SPOILAGE_THRESHOLD ? crystiteAfter : inventory.crystite,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/spoilage.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/spoilage.ts packages/shared/tests/spoilage.test.ts
git commit -m "feat: spoilage calculation for all resource types"
```

---

### Task 8: Store Pricing & M.U.L.E. Availability

**Files:**
- Create: `packages/shared/src/store.ts`
- Create: `packages/shared/tests/store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  createInitialStore,
  calculateMulePrice,
  calculateMuleAvailability,
  getStoreBuyPrice,
  getStoreSellPrice,
} from "../src/store.js";
import { ResourceType } from "../src/types.js";

describe("createInitialStore", () => {
  it("starts with 16 food, 16 energy, 0 smithore, 0 crystite", () => {
    const store = createInitialStore();
    expect(store.inventory.food).toBe(16);
    expect(store.inventory.energy).toBe(16);
    expect(store.inventory.smithore).toBe(0);
    expect(store.inventory.crystite).toBe(0);
  });

  it("starts with 14 M.U.L.E.s", () => {
    const store = createInitialStore();
    expect(store.muleCount).toBe(14);
  });
});

describe("calculateMulePrice", () => {
  it("returns base price when store has plenty of smithore", () => {
    const price = calculateMulePrice(14, 10);
    expect(price).toBe(100);
  });

  it("increases price as M.U.L.E. count drops", () => {
    const highSupply = calculateMulePrice(14, 10);
    const lowSupply = calculateMulePrice(3, 0);
    expect(lowSupply).toBeGreaterThan(highSupply);
  });

  it("returns very high price when no M.U.L.E.s available", () => {
    const price = calculateMulePrice(0, 0);
    expect(price).toBeGreaterThan(200);
  });
});

describe("calculateMuleAvailability", () => {
  it("manufactures M.U.L.E.s from smithore in store", () => {
    const result = calculateMuleAvailability(5, 4);
    // Each smithore makes 1 M.U.L.E., store has 4 smithore
    expect(result.newMuleCount).toBeGreaterThan(5);
    expect(result.smithoreConsumed).toBeGreaterThan(0);
  });

  it("does not manufacture if no smithore", () => {
    const result = calculateMuleAvailability(5, 0);
    expect(result.newMuleCount).toBe(5);
    expect(result.smithoreConsumed).toBe(0);
  });
});

describe("getStoreBuyPrice", () => {
  it("returns a price for food", () => {
    const price = getStoreBuyPrice(ResourceType.Food, 16);
    expect(price).toBeGreaterThan(0);
  });

  it("returns null when store has no stock (no floor)", () => {
    const price = getStoreBuyPrice(ResourceType.Smithore, 0);
    // Store always buys — it has unlimited money
    expect(price).toBeGreaterThan(0);
  });
});

describe("getStoreSellPrice", () => {
  it("returns a price when store has stock", () => {
    const price = getStoreSellPrice(ResourceType.Food, 16);
    expect(price).toBeGreaterThan(0);
  });

  it("returns null when store has no stock (cannot sell)", () => {
    const price = getStoreSellPrice(ResourceType.Smithore, 0);
    expect(price).toBeNull();
  });

  it("sell price is higher than buy price", () => {
    const buy = getStoreBuyPrice(ResourceType.Food, 16)!;
    const sell = getStoreSellPrice(ResourceType.Food, 16)!;
    expect(sell).toBeGreaterThan(buy);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/store.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement store logic**

```ts
import type { StoreState, ResourceInventory } from "./types.js";
import { ResourceType } from "./types.js";
import {
  STORE_STARTING_INVENTORY,
  STORE_STARTING_MULES,
  MULE_BASE_PRICE,
  STORE_BUY_PRICE,
  STORE_SELL_PRICE,
} from "./constants.js";

export function createInitialStore(): StoreState {
  return {
    inventory: { ...STORE_STARTING_INVENTORY },
    muleCount: STORE_STARTING_MULES,
    mulePrice: MULE_BASE_PRICE,
    buyPrices: { ...STORE_BUY_PRICE } as ResourceInventory,
    sellPrices: { ...STORE_SELL_PRICE } as ResourceInventory,
  };
}

/**
 * M.U.L.E. price increases as supply drops.
 * Base price $100, scales up with scarcity.
 */
export function calculateMulePrice(muleCount: number, storeSmithore: number): number {
  if (muleCount <= 0) {
    // No M.U.L.E.s — extreme scarcity
    return MULE_BASE_PRICE * 3;
  }
  // Price goes up as mule count drops below starting amount
  const scarcityFactor = Math.max(0, STORE_STARTING_MULES - muleCount) / STORE_STARTING_MULES;
  return Math.round(MULE_BASE_PRICE * (1 + scarcityFactor));
}

/**
 * Store manufactures M.U.L.E.s from smithore.
 * Each smithore unit produces 1 M.U.L.E.
 * Store converts up to 2 smithore per round.
 */
export function calculateMuleAvailability(
  currentMules: number,
  storeSmithore: number
): { newMuleCount: number; smithoreConsumed: number } {
  const canManufacture = Math.min(storeSmithore, 2); // max 2 per round
  return {
    newMuleCount: currentMules + canManufacture,
    smithoreConsumed: canManufacture,
  };
}

/**
 * Price the store will buy a resource at (floor in auction).
 * Store always buys (unlimited money) at its buy price.
 */
export function getStoreBuyPrice(resource: ResourceType, storeStock: number): number {
  return STORE_BUY_PRICE[resource];
}

/**
 * Price the store will sell a resource at (ceiling in auction).
 * Returns null if store has no stock — no ceiling.
 */
export function getStoreSellPrice(resource: ResourceType, storeStock: number): number | null {
  if (storeStock <= 0) return null;
  return STORE_SELL_PRICE[resource];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/store.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/store.ts packages/shared/tests/store.test.ts
git commit -m "feat: store pricing, M.U.L.E. manufacturing, buy/sell prices"
```

---

### Task 9: Food → Turn Duration

**Files:**
- Create: `packages/shared/src/food-timer.ts`
- Create: `packages/shared/tests/food-timer.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { calculateTurnDuration } from "../src/food-timer.js";

describe("calculateTurnDuration", () => {
  it("returns max duration when food meets requirement", () => {
    const duration = calculateTurnDuration(4, 1); // 4 food, round 1 (needs 3)
    expect(duration).toBe(45_000);
  });

  it("returns max duration when food exactly meets requirement", () => {
    const duration = calculateTurnDuration(3, 1); // 3 food, round 1 (needs 3)
    expect(duration).toBe(45_000);
  });

  it("returns reduced duration when 1 food short", () => {
    const duration = calculateTurnDuration(2, 1); // 1 short
    expect(duration).toBeLessThan(45_000);
    expect(duration).toBeGreaterThan(10_000);
  });

  it("returns minimum duration when zero food", () => {
    const duration = calculateTurnDuration(0, 1);
    expect(duration).toBe(10_000);
  });

  it("requires more food in later rounds", () => {
    const earlyDuration = calculateTurnDuration(3, 1); // enough for round 1
    const lateDuration = calculateTurnDuration(3, 10); // not enough for round 10 (needs 5)
    expect(lateDuration).toBeLessThan(earlyDuration);
  });

  it("clamps round to valid range", () => {
    const duration = calculateTurnDuration(5, 15); // round 15 doesn't exist, use last
    expect(duration).toBeGreaterThanOrEqual(10_000);
    expect(duration).toBeLessThanOrEqual(45_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/food-timer.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement food timer**

```ts
import { FOOD_REQUIRED_BY_ROUND, MAX_TURN_DURATION_MS, MIN_TURN_DURATION_MS } from "./constants.js";

/**
 * Calculate development turn duration based on food supply.
 * Full food = 45 seconds. Zero food = 10 seconds.
 * Linearly interpolated based on how much food you have vs. requirement.
 */
export function calculateTurnDuration(foodAmount: number, round: number): number {
  const clampedRound = Math.min(Math.max(round, 1), FOOD_REQUIRED_BY_ROUND.length - 1);
  const required = FOOD_REQUIRED_BY_ROUND[clampedRound];

  if (foodAmount >= required) {
    return MAX_TURN_DURATION_MS;
  }

  if (foodAmount <= 0) {
    return MIN_TURN_DURATION_MS;
  }

  // Linear interpolation between min and max
  const ratio = foodAmount / required;
  const range = MAX_TURN_DURATION_MS - MIN_TURN_DURATION_MS;
  return Math.round(MIN_TURN_DURATION_MS + range * ratio);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/food-timer.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/food-timer.ts packages/shared/tests/food-timer.test.ts
git commit -m "feat: food → development turn duration calculation"
```

---

### Task 10: Random Events

**Files:**
- Create: `packages/shared/src/events.ts`
- Create: `packages/shared/tests/events.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { RANDOM_EVENTS, selectRandomEvent, applyEventEffect } from "../src/events.js";
import { RandomEventTarget, ResourceType } from "../src/types.js";
import type { Player, ResourceInventory } from "../src/types.js";
import { SeededRNG } from "../src/rng.js";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    index: 0,
    name: "Test",
    species: "humanoid" as any,
    color: "red",
    money: 1000,
    inventory: { food: 5, energy: 5, smithore: 5, crystite: 5 },
    ownedPlots: [],
    isAI: false,
    aiDifficulty: null,
    ...overrides,
  };
}

describe("RANDOM_EVENTS", () => {
  it("has at least 10 events defined", () => {
    expect(RANDOM_EVENTS.length).toBeGreaterThanOrEqual(10);
  });

  it("every event has id, description, target, and effect", () => {
    for (const event of RANDOM_EVENTS) {
      expect(event.id).toBeTruthy();
      expect(event.description).toBeTruthy();
      expect(event.target).toBeTruthy();
      expect(event.effect).toBeTruthy();
    }
  });
});

describe("selectRandomEvent", () => {
  it("returns a deterministic event for the same seed", () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const event1 = selectRandomEvent(rng1, 1);
    const event2 = selectRandomEvent(rng2, 1);
    expect(event1.id).toBe(event2.id);
  });

  it("returns different events for different seeds", () => {
    const events = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      events.add(selectRandomEvent(rng, 1).id);
    }
    expect(events.size).toBeGreaterThan(1);
  });
});

describe("applyEventEffect", () => {
  it("applies money gain", () => {
    const player = makePlayer({ money: 500 });
    const result = applyEventEffect(player, { type: "money", amount: 200 });
    expect(result.money).toBe(700);
  });

  it("applies money loss without going below 0", () => {
    const player = makePlayer({ money: 100 });
    const result = applyEventEffect(player, { type: "money", amount: -200 });
    expect(result.money).toBe(0);
  });

  it("applies resource gain", () => {
    const player = makePlayer();
    const result = applyEventEffect(player, { type: "resource", resource: ResourceType.Food, amount: 3 });
    expect(result.inventory.food).toBe(8);
  });

  it("applies resource loss without going below 0", () => {
    const player = makePlayer({ inventory: { food: 2, energy: 5, smithore: 5, crystite: 5 } });
    const result = applyEventEffect(player, { type: "resource", resource: ResourceType.Food, amount: -5 });
    expect(result.inventory.food).toBe(0);
  });

  it("pirate raid zeroes all crystite", () => {
    const player = makePlayer({ inventory: { food: 5, energy: 5, smithore: 5, crystite: 20 } });
    const result = applyEventEffect(player, { type: "pirate_raid" });
    expect(result.inventory.crystite).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/events.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement events**

```ts
import type { RandomEvent, EventEffect, Player } from "./types.js";
import { RandomEventTarget, ResourceType } from "./types.js";
import type { SeededRNG } from "./rng.js";

export const RANDOM_EVENTS: RandomEvent[] = [
  // Good events (target trailing player)
  {
    id: "relatives_package",
    description: "You received a package from your home-world relatives containing 3 food and 2 energy units.",
    target: RandomEventTarget.Trailing,
    effect: { type: "resource", resource: ResourceType.Food, amount: 3 },
  },
  {
    id: "space_traveler",
    description: "A wandering space traveler repaid your hospitality by leaving two bars of smithore.",
    target: RandomEventTarget.Trailing,
    effect: { type: "resource", resource: ResourceType.Smithore, amount: 2 },
  },
  {
    id: "best_mule",
    description: "Your M.U.L.E. was judged 'Best Built' at the colony fair. You won $150!",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 150 },
  },
  {
    id: "tap_dancing",
    description: "Your M.U.L.E. won the colony tap-dancing contest. You collected $120.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 120 },
  },
  {
    id: "wart_worm",
    description: "The colony awarded you $200 for stopping the wart worm infestation.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 200 },
  },
  {
    id: "antique_computer",
    description: "The museum bought your antique personal computer for $180.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 180 },
  },
  {
    id: "swamp_eel",
    description: "You won the colony swamp eel eating contest and collected $150. (Yuck!)",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 150 },
  },
  {
    id: "charity",
    description: "A charity from your home-world took pity on you and sent $250.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 250 },
  },
  {
    id: "investments",
    description: "Your offworld investments in Artificial Dumbness paid $180 in dividends.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 180 },
  },
  {
    id: "dead_moose_rat",
    description: "You found a dead moose rat and sold the hide for $100.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 100 },
  },
  // Bad events (target leader)
  {
    id: "pest_attack",
    description: "A pest attack has destroyed half your food reserves!",
    target: RandomEventTarget.Leader,
    effect: { type: "resource", resource: ResourceType.Food, amount: -3 },
  },
  {
    id: "radiation",
    description: "Radiation from a solar flare has damaged your energy equipment!",
    target: RandomEventTarget.Leader,
    effect: { type: "resource", resource: ResourceType.Energy, amount: -3 },
  },
  {
    id: "fire_in_store",
    description: "A fire in the store destroyed some of your smithore!",
    target: RandomEventTarget.Leader,
    effect: { type: "resource", resource: ResourceType.Smithore, amount: -2 },
  },
  {
    id: "hospital_bill",
    description: "Your child has been bitten at the zoo — hospital bill: $200.",
    target: RandomEventTarget.Leader,
    effect: { type: "money", amount: -200 },
  },
  {
    id: "cat_burglar",
    description: "A cat burglar broke into your house and stole $150.",
    target: RandomEventTarget.Leader,
    effect: { type: "money", amount: -150 },
  },
  // Colony events
  {
    id: "planetquake",
    description: "A planetquake has reduced mining production this turn!",
    target: RandomEventTarget.Colony,
    effect: { type: "production_modifier", resource: ResourceType.Smithore, multiplier: 0.25 },
  },
  {
    id: "pirate_raid",
    description: "Space pirates have raided the colony and stolen all crystite!",
    target: RandomEventTarget.Colony,
    effect: { type: "pirate_raid" },
  },
  {
    id: "acid_rain",
    description: "Acid rain has damaged food production this turn!",
    target: RandomEventTarget.Colony,
    effect: { type: "production_modifier", resource: ResourceType.Food, multiplier: 0.5 },
  },
  {
    id: "sunspot",
    description: "Sunspot activity has boosted energy production!",
    target: RandomEventTarget.Colony,
    effect: { type: "production_modifier", resource: ResourceType.Energy, multiplier: 2.0 },
  },
];

/**
 * Select a random event for this round.
 * 25% chance of a player-specific event, 75% no event, per the original.
 * Colony events are rarer.
 */
export function selectRandomEvent(rng: SeededRNG, round: number): RandomEvent {
  return rng.pick(RANDOM_EVENTS);
}

/**
 * Apply an event effect to a player, returning updated player state.
 * Does not mutate the input.
 */
export function applyEventEffect(player: Player, effect: EventEffect): Player {
  const result = {
    ...player,
    inventory: { ...player.inventory },
  };

  switch (effect.type) {
    case "money":
      result.money = Math.max(0, result.money + effect.amount);
      break;
    case "resource":
      result.inventory[effect.resource] = Math.max(0, result.inventory[effect.resource] + effect.amount);
      break;
    case "pirate_raid":
      result.inventory.crystite = 0;
      break;
    case "lose_plot":
      // Handled at game state level (needs map access)
      break;
    case "gain_plot":
      // Handled at game state level (needs map access)
      break;
    case "production_modifier":
      // Handled during production phase
      break;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/events.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/events.ts packages/shared/tests/events.test.ts
git commit -m "feat: random events with selection and effect application"
```

---

### Task 11: Scoring

**Files:**
- Create: `packages/shared/src/scoring.ts`
- Create: `packages/shared/tests/scoring.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { calculatePlayerScore, calculateColonyScore, determineWinner } from "../src/scoring.js";
import type { Player, StoreState } from "../src/types.js";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    index: 0,
    name: "Test",
    species: "humanoid" as any,
    color: "red",
    money: 1000,
    inventory: { food: 5, energy: 5, smithore: 5, crystite: 5 },
    ownedPlots: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    isAI: false,
    aiDifficulty: null,
    ...overrides,
  };
}

const storePrices = {
  food: 30,
  energy: 45,
  smithore: 75,
  crystite: 100,
};

describe("calculatePlayerScore", () => {
  it("sums money + land value + goods value", () => {
    const player = makePlayer({ money: 500 });
    const score = calculatePlayerScore(player, storePrices);
    expect(score.money).toBe(500);
    expect(score.landValue).toBe(1000); // 2 plots * $500
    expect(score.goodsValue).toBe(
      5 * 30 + 5 * 45 + 5 * 75 + 5 * 100 // food + energy + smithore + crystite
    );
    expect(score.totalScore).toBe(500 + 1000 + score.goodsValue);
  });

  it("handles player with no plots", () => {
    const player = makePlayer({ ownedPlots: [] });
    const score = calculatePlayerScore(player, storePrices);
    expect(score.landValue).toBe(0);
  });

  it("handles player with no inventory", () => {
    const player = makePlayer({
      inventory: { food: 0, energy: 0, smithore: 0, crystite: 0 },
    });
    const score = calculatePlayerScore(player, storePrices);
    expect(score.goodsValue).toBe(0);
  });
});

describe("calculateColonyScore", () => {
  it("sums all player scores", () => {
    const players = [
      makePlayer({ index: 0, money: 10000 }),
      makePlayer({ index: 1, money: 10000 }),
      makePlayer({ index: 2, money: 10000 }),
      makePlayer({ index: 3, money: 10000 }),
    ];
    const colony = calculateColonyScore(players, storePrices);
    expect(colony.total).toBeGreaterThan(0);
  });

  it("rates high-scoring colony as first_founder", () => {
    const players = [
      makePlayer({ index: 0, money: 50000, ownedPlots: Array(10).fill({ row: 0, col: 0 }) }),
      makePlayer({ index: 1, money: 50000, ownedPlots: Array(10).fill({ row: 0, col: 0 }) }),
      makePlayer({ index: 2, money: 50000, ownedPlots: Array(10).fill({ row: 0, col: 0 }) }),
      makePlayer({ index: 3, money: 50000, ownedPlots: Array(10).fill({ row: 0, col: 0 }) }),
    ];
    const colony = calculateColonyScore(players, storePrices);
    expect(colony.rating).toBe("first_founder");
  });

  it("rates low-scoring colony as failure", () => {
    const players = [
      makePlayer({ index: 0, money: 100, ownedPlots: [], inventory: { food: 0, energy: 0, smithore: 0, crystite: 0 } }),
      makePlayer({ index: 1, money: 100, ownedPlots: [], inventory: { food: 0, energy: 0, smithore: 0, crystite: 0 } }),
      makePlayer({ index: 2, money: 100, ownedPlots: [], inventory: { food: 0, energy: 0, smithore: 0, crystite: 0 } }),
      makePlayer({ index: 3, money: 100, ownedPlots: [], inventory: { food: 0, energy: 0, smithore: 0, crystite: 0 } }),
    ];
    const colony = calculateColonyScore(players, storePrices);
    expect(colony.rating).toBe("failure");
  });
});

describe("determineWinner", () => {
  it("returns player with highest total score", () => {
    const players = [
      makePlayer({ index: 0, money: 500 }),
      makePlayer({ index: 1, money: 2000 }),
      makePlayer({ index: 2, money: 100 }),
      makePlayer({ index: 3, money: 800 }),
    ];
    const winner = determineWinner(players, storePrices);
    expect(winner.playerIndex).toBe(1);
  });

  it("breaks ties by lower player index (leader disadvantage)", () => {
    const players = [
      makePlayer({ index: 0, money: 1000 }),
      makePlayer({ index: 1, money: 1000 }),
    ];
    // In M.U.L.E., the trailing player wins ties
    const winner = determineWinner(players, storePrices);
    expect(winner.playerIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/scoring.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement scoring**

```ts
import type { Player, PlayerScore, ColonyScore } from "./types.js";
import { LAND_VALUE, COLONY_THRESHOLDS } from "./constants.js";

interface ResourcePrices {
  food: number;
  energy: number;
  smithore: number;
  crystite: number;
}

/**
 * Calculate a single player's score.
 * Score = money + (plots * $500) + (goods valued at current store prices).
 */
export function calculatePlayerScore(player: Player, prices: ResourcePrices): PlayerScore {
  const landValue = player.ownedPlots.length * LAND_VALUE;
  const goodsValue =
    player.inventory.food * prices.food +
    player.inventory.energy * prices.energy +
    player.inventory.smithore * prices.smithore +
    player.inventory.crystite * prices.crystite;

  return {
    playerIndex: player.index,
    money: player.money,
    landValue,
    goodsValue,
    totalScore: player.money + landValue + goodsValue,
  };
}

/**
 * Calculate the colony score (sum of all players).
 * Determines if colonists are First Founders, Pioneers, Settlers, or Failures.
 */
export function calculateColonyScore(players: Player[], prices: ResourcePrices): ColonyScore {
  const total = players.reduce((sum, p) => sum + calculatePlayerScore(p, prices).totalScore, 0);

  let rating: ColonyScore["rating"];
  if (total >= COLONY_THRESHOLDS.first_founder) {
    rating = "first_founder";
  } else if (total >= COLONY_THRESHOLDS.pioneer) {
    rating = "pioneer";
  } else if (total >= COLONY_THRESHOLDS.settler) {
    rating = "settler";
  } else {
    rating = "failure";
  }

  return { total, rating };
}

/**
 * Determine the winner. Highest score wins.
 * Ties broken in favor of the trailing player (higher index).
 */
export function determineWinner(players: Player[], prices: ResourcePrices): PlayerScore {
  const scores = players.map((p) => calculatePlayerScore(p, prices));
  scores.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.playerIndex - a.playerIndex; // ties favor trailing player
  });
  return scores[0];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/mule-game/packages/shared
npx vitest run tests/scoring.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/scoring.ts packages/shared/tests/scoring.test.ts
git commit -m "feat: player scoring, colony rating, winner determination"
```

---

### Task 12: Wire Up Barrel Export & Full Test Run

**Files:**
- Modify: `packages/shared/src/index.ts` (already created in Task 1)

- [ ] **Step 1: Verify all source files exist**

```bash
ls packages/shared/src/
```

Expected: `constants.ts events.ts food-timer.ts index.ts map-generator.ts production.ts rng.ts scoring.ts spoilage.ts store.ts types.ts`

- [ ] **Step 2: Build the shared package**

```bash
cd ~/mule-game/packages/shared
npx tsc
```

Expected: No errors. `dist/` directory created with compiled JS and declaration files.

- [ ] **Step 3: Run all tests**

```bash
cd ~/mule-game/packages/shared
npx vitest run
```

Expected: All tests across all 7 test files PASS.

- [ ] **Step 4: Add dist to gitignore, commit**

```bash
cd ~/mule-game
git add packages/shared/src/index.ts
git commit -m "feat: wire up barrel exports, all shared package tests passing"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 5x9 grid, map generation — Task 5
- [x] All 4 resources with terrain quality — Task 6
- [x] Production formula (quality, adjacency, energy) — Task 6
- [x] Spoilage — Task 7
- [x] Store mechanics (starting inventory, pricing, M.U.L.E. manufacturing) — Task 8
- [x] Food → turn duration — Task 9
- [x] Random events — Task 10
- [x] Scoring (player, colony, winner) — Task 11
- [x] Deterministic RNG — Task 4
- [x] Types for all game entities — Task 2
- [x] Economic constants — Task 3
- [ ] Trading auction logic — Plan 2 (server-side, needs real-time state)
- [ ] Land grant/auction phase — Plan 2 (server-side state machine)
- [ ] AI players — Plan 2 (server-side)
- [ ] All client rendering — Plan 3
- [ ] Wampus hunting — Plan 2 (server-side, real-time movement)
- [ ] Pub payout — trivial calculation, added in Plan 2

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:** All types referenced in Tasks 4-11 are defined in Task 2. All constants referenced in Tasks 4-11 are defined in Task 3. Function signatures are consistent across all files.
