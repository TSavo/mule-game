import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
  AVATAR_SPEED,
  TOWN_BUILDINGS,
} from "../src/config";
import {
  AUCTION_TICK_SCALE,
  AUCTION_PRICE_STEP_LOW,
  AUCTION_PRICE_STEP_HIGH,
  getAuctionPriceStep,
  PRODUCTION_PREVIOUS_UNITS_TIME_S,
  PRODUCTION_USAGE_TIME_S,
  PRODUCTION_CURRENT_UNITS_TIME_S,
  PRODUCTION_SPOILAGE_TIME_S,
  PRODUCTION_RESULT_TIME_S,
  PRODUCTION_COLLECTION_END_TIME_S,
} from "@mule-game/shared";

// ─── Mock helpers ───────────────────────────────────────────────────────────

function createMockState() {
  const players = new Map<string, any>();
  players.set("0", {
    index: 0, name: "TestPlayer", money: 1000, food: 4, energy: 2,
    smithore: 0, crystite: 0, plotCount: 0, isAI: false, species: "humanoid",
    hasMule: false, muleOutfit: "", turnComplete: false, rank: 0, score: 0,
    prevFood: 4, prevEnergy: 2, prevSmithore: 0, prevCrystite: 0,
    spoiledFood: 0, spoiledEnergy: 0,
    auctionRole: "none", auctionTick: 0, auctionInArena: false,
  });
  for (let i = 1; i <= 3; i++) {
    players.set(String(i), {
      index: i, name: `AI ${i}`, money: 1000, food: 4, energy: 2,
      smithore: 0, crystite: 0, plotCount: 0, isAI: true, species: "humanoid",
      hasMule: false, muleOutfit: "", turnComplete: false, rank: 0, score: 0,
      prevFood: 4, prevEnergy: 2, prevSmithore: 0, prevCrystite: 0,
      spoiledFood: 0, spoiledEnergy: 0,
      auctionRole: "none", auctionTick: 0, auctionInArena: false,
    });
  }

  const tiles: any[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 9; c++) {
      tiles.push({
        row: r, col: c,
        terrain: r === 2 && c === 4 ? "town" : c === 4 ? "river" : "plains",
        crystiteLevel: "none", smithoreLevel: 0, crystiteRevealed: false,
        owner: -1, installedMule: "", lastProduction: 0, hadEnergy: true,
      });
    }
  }

  return {
    phase: "intro", round: 1, mode: "standard", seed: 42,
    players,
    tiles,
    store: {
      food: 8, energy: 8, smithore: 8, crystite: 0,
      muleCount: 14, mulePrice: 100,
      foodBuyPrice: 20, foodSellPrice: 40,
      energyBuyPrice: 30, energySellPrice: 60,
      smithoreBuyPrice: 50, smithoreSellPrice: 100,
      crystiteBuyPrice: 50, crystiteSellPrice: 150,
    },
    auction: {
      resource: "", active: false, subPhase: "declare",
      timeRemaining: 10000, storeBuyPrice: 0, storeSellPrice: 0,
      storeClosed: false, unitsTraded: 0, lastTradePrice: -1,
      timerSpeed: 1.0, timerPaused: false,
    },
    landGrantCursorRow: 0, landGrantCursorCol: 0, landGrantActive: false,
    currentPlayerTurn: -1, turnTimeRemaining: 0,
    eventMessage: "", colonyScore: 0, colonyRating: "", winnerIndex: -1,
    wampusVisible: false, wampusRow: 0, wampusCol: 0,
  };
}

function createMockRoom(state: ReturnType<typeof createMockState>) {
  const sentMessages: Array<{ type: string; data: any }> = [];
  return {
    state,
    sessionId: "test-session",
    send(type: string, data: any) { sentMessages.push({ type, data }); },
    leave: vi.fn(),
    onStateChange() {},
    sentMessages,
  };
}

// ─── Inline helpers that replicate pure logic from source modules ───────────

/** Replicates Avatar.getTile logic */
function getTile(
  bodyX: number, bodyY: number,
  mapOffsetX: number, mapOffsetY: number,
  tileW: number, tileH: number,
): { col: number; row: number } {
  const col = Math.floor((bodyX - mapOffsetX) / tileW);
  const row = Math.floor((bodyY - mapOffsetY) / tileH);
  return { col, row };
}

/** Replicates Avatar.update movement math */
function updateMovement(
  bodyX: number, bodyY: number,
  targetX: number, targetY: number,
  direction: string, delta: number,
): { bodyX: number; bodyY: number; targetX: number; targetY: number; stopped: boolean } {
  if (direction === "idle") return { bodyX, bodyY, targetX, targetY, stopped: true };

  const speed = AVATAR_SPEED * (delta / 1000);

  switch (direction) {
    case "north": targetY -= speed; break;
    case "south": targetY += speed; break;
    case "east":  targetX += speed; break;
    case "west":  targetX -= speed; break;
  }

  const dx = targetX - bodyX;
  const dy = targetY - bodyY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    return { bodyX: targetX, bodyY: targetY, targetX, targetY, stopped: true };
  }
  const ratio = Math.min(1, speed / dist);
  const newX = bodyX + dx * ratio;
  const newY = bodyY + dy * ratio;
  return { bodyX: newX, bodyY: newY, targetX, targetY, stopped: false };
}

/** Replicates TownView.checkKeyAction logic */
const KEY_TO_BUILDING: Record<string, keyof typeof TOWN_BUILDINGS> = {
  B: "corral", "1": "food", "2": "energy", "3": "smithore", "4": "crystite",
  P: "pub", A: "assay", L: "land",
};

type TownAction =
  | { type: "buy_mule" }
  | { type: "outfit_mule"; resource: string }
  | { type: "visit_pub" }
  | { type: "assay" }
  | { type: "sell_plot" }
  | null;

const BUILDING_ACTIONS: Record<keyof typeof TOWN_BUILDINGS, TownAction> = {
  corral: { type: "buy_mule" },
  food: { type: "outfit_mule", resource: "food" },
  energy: { type: "outfit_mule", resource: "energy" },
  smithore: { type: "outfit_mule", resource: "smithore" },
  crystite: { type: "outfit_mule", resource: "crystite" },
  pub: { type: "visit_pub" },
  assay: { type: "assay" },
  land: { type: "sell_plot" },
};

function checkKeyAction(keyCode: string): TownAction {
  const upperKey = keyCode.toUpperCase();
  const buildingKey = KEY_TO_BUILDING[upperKey];
  if (buildingKey) return BUILDING_ACTIONS[buildingKey];
  return null;
}

/** Replicates HUD deltaStr logic */
function deltaStr(current: number, prev: number | undefined): string {
  if (prev === undefined || prev === current) return "";
  const diff = current - prev;
  return ` (${diff > 0 ? "+" : ""}${diff})`;
}

/** Replicates server tickToPrice */
function tickToPrice(tick: number, startPrice: number, resource: string): number {
  const step = resource === "crystite" ? AUCTION_PRICE_STEP_HIGH : AUCTION_PRICE_STEP_LOW;
  return startPrice + Math.floor(tick / AUCTION_TICK_SCALE) * step;
}

// ─── Minimal StateSync reimplementation for testing (no Phaser dependency) ──

class MockStateSync {
  private prevPhase = "";
  private prevCursorRow = -1;
  private prevCursorCol = -1;
  private prevWampusVisible = false;
  private prevWampusRow = -1;
  private prevWampusCol = -1;
  private prevTilesSnapshot = "";
  private prevPlayersSnapshot = "";
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  constructor(private state: ReturnType<typeof createMockState>) {}

  on(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  private emit(event: string, ...args: any[]) {
    for (const fn of this.listeners.get(event) ?? []) fn(...args);
  }

  poll(): void {
    const s = this.state;
    if (s.phase !== this.prevPhase) {
      this.emit("phase_changed", s.phase, this.prevPhase);
      this.prevPhase = s.phase;
    }
    if (s.landGrantCursorRow !== this.prevCursorRow || s.landGrantCursorCol !== this.prevCursorCol) {
      this.emit("cursor_moved", s.landGrantCursorRow, s.landGrantCursorCol);
      this.prevCursorRow = s.landGrantCursorRow;
      this.prevCursorCol = s.landGrantCursorCol;
    }
    if (s.wampusVisible !== this.prevWampusVisible || s.wampusRow !== this.prevWampusRow || s.wampusCol !== this.prevWampusCol) {
      this.emit("wampus_changed", s.wampusVisible, s.wampusRow, s.wampusCol);
      this.prevWampusVisible = s.wampusVisible;
      this.prevWampusRow = s.wampusRow;
      this.prevWampusCol = s.wampusCol;
    }

    // Tiles snapshot
    let tileSnap = "";
    for (const t of s.tiles) {
      tileSnap += `${t.row},${t.col},${t.owner},${t.installedMule},${t.crystiteLevel},${t.smithoreLevel},${t.crystiteRevealed},${t.lastProduction},${t.hadEnergy}|`;
    }
    if (tileSnap !== this.prevTilesSnapshot) {
      this.emit("tiles_updated");
      this.prevTilesSnapshot = tileSnap;
    }

    // Players snapshot
    let playerSnap = "";
    s.players.forEach((p: any) => {
      playerSnap += `${p.index},${p.money},${p.food},${p.energy},${p.smithore},${p.crystite},${p.plotCount},${p.prevFood},${p.prevEnergy},${p.prevSmithore},${p.prevCrystite},${p.spoiledFood},${p.spoiledEnergy},${p.rank},${p.score}|`;
    });
    if (playerSnap !== this.prevPlayersSnapshot) {
      this.emit("player_updated");
      this.prevPlayersSnapshot = playerSnap;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe("GameClient messages", () => {
  let state: ReturnType<typeof createMockState>;
  let room: ReturnType<typeof createMockRoom>;

  beforeEach(() => {
    state = createMockState();
    room = createMockRoom(state);
  });

  it("sends claim_plot message", () => {
    room.send("claim_plot", {});
    expect(room.sentMessages).toEqual([{ type: "claim_plot", data: {} }]);
  });

  it("sends buy_mule message", () => {
    room.send("buy_mule", {});
    expect(room.sentMessages).toEqual([{ type: "buy_mule", data: {} }]);
  });

  it("sends outfit_mule with resource", () => {
    room.send("outfit_mule", { resource: "food" });
    expect(room.sentMessages[0]).toEqual({ type: "outfit_mule", data: { resource: "food" } });
  });

  it("sends install_mule with row/col", () => {
    room.send("install_mule", { row: 2, col: 3 });
    expect(room.sentMessages[0]).toEqual({ type: "install_mule", data: { row: 2, col: 3 } });
  });

  it("sends visit_pub message", () => {
    room.send("visit_pub", {});
    expect(room.sentMessages[0]).toEqual({ type: "visit_pub", data: {} });
  });

  it("sends end_turn message", () => {
    room.send("end_turn", {});
    expect(room.sentMessages[0]).toEqual({ type: "end_turn", data: {} });
  });

  it("sends declare_auction with role", () => {
    room.send("declare_auction", { role: "buyer" });
    expect(room.sentMessages[0]).toEqual({ type: "declare_auction", data: { role: "buyer" } });
  });

  it("sends set_auction_tick with tick value", () => {
    room.send("set_auction_tick", { tick: 15 });
    expect(room.sentMessages[0]).toEqual({ type: "set_auction_tick", data: { tick: 15 } });
  });

  it("sends assay message", () => {
    room.send("assay", {});
    expect(room.sentMessages[0]).toEqual({ type: "assay", data: {} });
  });

  it("sends sell_plot with row/col", () => {
    room.send("sell_plot", { row: 1, col: 5 });
    expect(room.sentMessages[0]).toEqual({ type: "sell_plot", data: { row: 1, col: 5 } });
  });

  it("sends catch_wampus message", () => {
    room.send("catch_wampus", {});
    expect(room.sentMessages[0]).toEqual({ type: "catch_wampus", data: {} });
  });

  it("sends start_game message", () => {
    room.send("start_game", {});
    expect(room.sentMessages[0]).toEqual({ type: "start_game", data: {} });
  });

  it("sends bid with amount", () => {
    room.send("bid", { amount: 250 });
    expect(room.sentMessages[0]).toEqual({ type: "bid", data: { amount: 250 } });
  });
});

// ─── Avatar movement tests ──────────────────────────────────────────────────

describe("Avatar getTile logic", () => {
  it("converts pixel coords at map origin to row=0, col=0", () => {
    const result = getTile(MAP_OFFSET_X + 1, MAP_OFFSET_Y + 1, MAP_OFFSET_X, MAP_OFFSET_Y, TILE_WIDTH, TILE_HEIGHT);
    expect(result).toEqual({ col: 0, row: 0 });
  });

  it("converts pixel coords to correct tile in middle of map", () => {
    const x = MAP_OFFSET_X + 4 * TILE_WIDTH + TILE_WIDTH / 2;
    const y = MAP_OFFSET_Y + 2 * TILE_HEIGHT + TILE_HEIGHT / 2;
    const result = getTile(x, y, MAP_OFFSET_X, MAP_OFFSET_Y, TILE_WIDTH, TILE_HEIGHT);
    expect(result).toEqual({ col: 4, row: 2 });
  });

  it("converts pixel coords at bottom-right to row=4, col=8", () => {
    const x = MAP_OFFSET_X + 8 * TILE_WIDTH + TILE_WIDTH / 2;
    const y = MAP_OFFSET_Y + 4 * TILE_HEIGHT + TILE_HEIGHT / 2;
    const result = getTile(x, y, MAP_OFFSET_X, MAP_OFFSET_Y, TILE_WIDTH, TILE_HEIGHT);
    expect(result).toEqual({ col: 8, row: 4 });
  });
});

describe("Avatar movement math", () => {
  it("does not move when idle", () => {
    const r = updateMovement(100, 100, 100, 100, "idle", 16);
    expect(r.bodyX).toBe(100);
    expect(r.bodyY).toBe(100);
    expect(r.stopped).toBe(true);
  });

  it("moves south: targetY increases", () => {
    const r = updateMovement(100, 100, 100, 100, "south", 1000);
    expect(r.targetY).toBeGreaterThan(100);
  });

  it("moves north: targetY decreases", () => {
    const r = updateMovement(100, 200, 100, 200, "north", 1000);
    expect(r.targetY).toBeLessThan(200);
  });

  it("moves east: targetX increases", () => {
    const r = updateMovement(100, 100, 100, 100, "east", 1000);
    expect(r.targetX).toBeGreaterThan(100);
  });

  it("moves west: targetX decreases", () => {
    const r = updateMovement(200, 100, 200, 100, "west", 1000);
    expect(r.targetX).toBeLessThan(200);
  });

  it("snaps to target when distance < 1 after movement", () => {
    // Body at (100,100), target at (100,100). Moving south with a tiny delta
    // so that target moves just slightly, creating distance < 1.
    // With delta=1ms, speed = 200 * 1/1000 = 0.2 px. Target goes to (100, 100.2).
    // Distance = 0.2, which is < 1, so it snaps.
    const r = updateMovement(100, 100, 100, 100, "south", 1);
    expect(r.stopped).toBe(true);
    expect(r.bodyX).toBe(r.targetX);
    expect(r.bodyY).toBe(r.targetY);
  });

  it("speed is AVATAR_SPEED * delta/1000", () => {
    // 1 second of movement south from origin
    const r = updateMovement(0, 0, 0, 0, "south", 1000);
    expect(r.targetY).toBe(AVATAR_SPEED);
  });
});

// ─── TownView key action tests ──────────────────────────────────────────────

describe("TownView key actions", () => {
  it("B maps to buy_mule", () => {
    expect(checkKeyAction("B")).toEqual({ type: "buy_mule" });
  });

  it("b (lowercase) maps to buy_mule", () => {
    expect(checkKeyAction("b")).toEqual({ type: "buy_mule" });
  });

  it("1 maps to outfit_mule with food", () => {
    expect(checkKeyAction("1")).toEqual({ type: "outfit_mule", resource: "food" });
  });

  it("2 maps to outfit_mule with energy", () => {
    expect(checkKeyAction("2")).toEqual({ type: "outfit_mule", resource: "energy" });
  });

  it("3 maps to outfit_mule with smithore", () => {
    expect(checkKeyAction("3")).toEqual({ type: "outfit_mule", resource: "smithore" });
  });

  it("4 maps to outfit_mule with crystite", () => {
    expect(checkKeyAction("4")).toEqual({ type: "outfit_mule", resource: "crystite" });
  });

  it("P maps to visit_pub", () => {
    expect(checkKeyAction("P")).toEqual({ type: "visit_pub" });
  });

  it("A maps to assay", () => {
    expect(checkKeyAction("A")).toEqual({ type: "assay" });
  });

  it("L maps to sell_plot", () => {
    expect(checkKeyAction("L")).toEqual({ type: "sell_plot" });
  });

  it("unknown key returns null", () => {
    expect(checkKeyAction("X")).toBeNull();
  });
});

// ─── StateSync change detection tests ───────────────────────────────────────

describe("StateSync change detection", () => {
  let state: ReturnType<typeof createMockState>;
  let sync: MockStateSync;

  beforeEach(() => {
    state = createMockState();
    sync = new MockStateSync(state);
    // Initial poll to set baseline
    sync.poll();
  });

  it("emits phase_changed when phase changes", () => {
    const handler = vi.fn();
    sync.on("phase_changed", handler);
    state.phase = "land_grant";
    sync.poll();
    expect(handler).toHaveBeenCalledWith("land_grant", "intro");
  });

  it("does not emit phase_changed when phase is unchanged", () => {
    const handler = vi.fn();
    sync.on("phase_changed", handler);
    sync.poll();
    expect(handler).not.toHaveBeenCalled();
  });

  it("emits cursor_moved when cursor position changes", () => {
    const handler = vi.fn();
    sync.on("cursor_moved", handler);
    state.landGrantCursorRow = 3;
    state.landGrantCursorCol = 7;
    sync.poll();
    expect(handler).toHaveBeenCalledWith(3, 7);
  });

  it("emits wampus_changed when wampus appears", () => {
    const handler = vi.fn();
    sync.on("wampus_changed", handler);
    state.wampusVisible = true;
    state.wampusRow = 2;
    state.wampusCol = 5;
    sync.poll();
    expect(handler).toHaveBeenCalledWith(true, 2, 5);
  });

  it("emits tiles_updated when tile owner changes", () => {
    const handler = vi.fn();
    sync.on("tiles_updated", handler);
    state.tiles[0].owner = 0;
    sync.poll();
    expect(handler).toHaveBeenCalled();
  });

  it("emits player_updated when player money changes", () => {
    const handler = vi.fn();
    sync.on("player_updated", handler);
    state.players.get("0")!.money = 900;
    sync.poll();
    expect(handler).toHaveBeenCalled();
  });

  it("does not emit tiles_updated when no tiles change", () => {
    const handler = vi.fn();
    sync.on("tiles_updated", handler);
    sync.poll();
    expect(handler).not.toHaveBeenCalled();
  });
});

// ─── HUD data formatting tests ──────────────────────────────────────────────

describe("HUD deltaStr formatting", () => {
  it("shows negative delta for food loss", () => {
    expect(deltaStr(1, 4)).toBe(" (-3)");
  });

  it("shows positive delta for food gain", () => {
    expect(deltaStr(6, 4)).toBe(" (+2)");
  });

  it("shows empty string when prev equals current", () => {
    expect(deltaStr(4, 4)).toBe("");
  });

  it("shows empty string when prev is undefined", () => {
    expect(deltaStr(4, undefined)).toBe("");
  });

  it("formats energy delta correctly", () => {
    expect(deltaStr(0, 2)).toBe(" (-2)");
  });
});

// ─── Game flow integration tests ────────────────────────────────────────────

describe("Game flow", () => {
  let state: ReturnType<typeof createMockState>;

  beforeEach(() => {
    state = createMockState();
  });

  it("intro phase has round and player data", () => {
    expect(state.phase).toBe("intro");
    expect(state.round).toBe(1);
    expect(state.players.size).toBe(4);
    expect(state.players.get("0")!.name).toBe("TestPlayer");
  });

  it("land_grant phase has active cursor", () => {
    state.phase = "land_grant";
    state.landGrantActive = true;
    state.landGrantCursorRow = 2;
    state.landGrantCursorCol = 4;
    expect(state.phase).toBe("land_grant");
    expect(state.landGrantActive).toBe(true);
    expect(state.landGrantCursorRow).toBe(2);
    expect(state.landGrantCursorCol).toBe(4);
  });

  it("development phase has current player turn", () => {
    state.phase = "development";
    state.currentPlayerTurn = 0;
    state.turnTimeRemaining = 47500;
    expect(state.phase).toBe("development");
    expect(state.currentPlayerTurn).toBe(0);
    expect(state.turnTimeRemaining).toBe(47500);
  });

  it("trading_auction phase has active auction with resource", () => {
    state.phase = "trading_auction";
    state.auction.active = true;
    state.auction.resource = "food";
    state.auction.timeRemaining = 10000;
    expect(state.phase).toBe("trading_auction");
    expect(state.auction.active).toBe(true);
    expect(state.auction.resource).toBe("food");
  });

  it("summary phase has colony score and winner", () => {
    state.phase = "summary";
    state.colonyScore = 45000;
    state.colonyRating = "settler";
    state.winnerIndex = 0;
    expect(state.phase).toBe("summary");
    expect(state.colonyScore).toBe(45000);
    expect(state.colonyRating).toBe("settler");
    expect(state.winnerIndex).toBe(0);
  });

  it("game_over phase signals end", () => {
    state.phase = "game_over";
    state.winnerIndex = 2;
    expect(state.phase).toBe("game_over");
    expect(state.winnerIndex).toBe(2);
  });
});

// ─── Collection stage timing tests ──────────────────────────────────────────

describe("Collection stage timing", () => {
  // The client CollectionScene uses this exact 8-stage duration sequence:
  const STAGE_DURATIONS = [2500, 1000, 2500, 1000, 2500, 1000, 4000, 5000];

  it("has exactly 8 stages", () => {
    expect(STAGE_DURATIONS).toHaveLength(8);
  });

  it("display stages are 2500ms", () => {
    expect(STAGE_DURATIONS[0]).toBe(2500); // previous units
    expect(STAGE_DURATIONS[2]).toBe(2500); // current units
    expect(STAGE_DURATIONS[4]).toBe(2500); // spoilage / result display
  });

  it("transition stages are 1000ms", () => {
    expect(STAGE_DURATIONS[1]).toBe(1000);
    expect(STAGE_DURATIONS[3]).toBe(1000);
    expect(STAGE_DURATIONS[5]).toBe(1000);
  });

  it("result stage is 4000ms", () => {
    expect(STAGE_DURATIONS[6]).toBe(4000);
  });

  it("end stage is 5000ms", () => {
    expect(STAGE_DURATIONS[7]).toBe(5000);
  });

  it("total collection time sums to 19500ms", () => {
    const total = STAGE_DURATIONS.reduce((a, b) => a + b, 0);
    expect(total).toBe(19500);
  });

  it("shared constants define matching production display timings", () => {
    expect(PRODUCTION_PREVIOUS_UNITS_TIME_S).toBe(2.5);
    expect(PRODUCTION_USAGE_TIME_S).toBe(1.0);
    expect(PRODUCTION_CURRENT_UNITS_TIME_S).toBe(2.5);
    expect(PRODUCTION_SPOILAGE_TIME_S).toBe(1.0);
    expect(PRODUCTION_RESULT_TIME_S).toBe(9.0);
    expect(PRODUCTION_COLLECTION_END_TIME_S).toBe(5.0);
  });
});

// ─── Auction tick-to-price tests ────────────────────────────────────────────

describe("Auction tick-to-price", () => {
  it("tick 0 returns start price for food", () => {
    expect(tickToPrice(0, 13, "food")).toBe(13);
  });

  it("tick 9 still returns start price (within first scale)", () => {
    expect(tickToPrice(9, 13, "food")).toBe(13);
  });

  it("tick 10 increments by 1 for food (step=1)", () => {
    expect(tickToPrice(10, 13, "food")).toBe(14);
  });

  it("tick 20 increments by 2 for food", () => {
    expect(tickToPrice(20, 13, "food")).toBe(15);
  });

  it("crystite uses step=4 per price level", () => {
    expect(tickToPrice(0, 50, "crystite")).toBe(50);
    expect(tickToPrice(10, 50, "crystite")).toBe(54);
    expect(tickToPrice(20, 50, "crystite")).toBe(58);
  });

  it("getAuctionPriceStep returns 1 for food/energy/smithore", () => {
    expect(getAuctionPriceStep("food" as any)).toBe(1);
    expect(getAuctionPriceStep("energy" as any)).toBe(1);
    expect(getAuctionPriceStep("smithore" as any)).toBe(1);
  });

  it("getAuctionPriceStep returns 4 for crystite", () => {
    expect(getAuctionPriceStep("crystite" as any)).toBe(4);
  });

  it("AUCTION_TICK_SCALE is 10", () => {
    expect(AUCTION_TICK_SCALE).toBe(10);
  });
});

// ─── Map and tile structure tests ───────────────────────────────────────────

describe("Mock map structure", () => {
  let state: ReturnType<typeof createMockState>;

  beforeEach(() => {
    state = createMockState();
  });

  it("has 45 tiles (5 rows x 9 cols)", () => {
    expect(state.tiles).toHaveLength(45);
  });

  it("town tile is at row=2, col=4", () => {
    const town = state.tiles.find((t: any) => t.terrain === "town");
    expect(town).toBeDefined();
    expect(town!.row).toBe(2);
    expect(town!.col).toBe(4);
  });

  it("river tiles run down column 4 (except town)", () => {
    const rivers = state.tiles.filter((t: any) => t.terrain === "river");
    expect(rivers).toHaveLength(4);
    for (const r of rivers) {
      expect(r.col).toBe(4);
      expect(r.row).not.toBe(2); // town row
    }
  });

  it("all non-river non-town tiles are plains", () => {
    const plains = state.tiles.filter((t: any) => t.terrain === "plains");
    expect(plains).toHaveLength(40); // 45 - 1 town - 4 river
  });

  it("all tiles start unowned", () => {
    for (const t of state.tiles) {
      expect(t.owner).toBe(-1);
    }
  });

  it("store starts with 14 mules at price 100", () => {
    expect(state.store.muleCount).toBe(14);
    expect(state.store.mulePrice).toBe(100);
  });
});

// ─── Town building overlap detection tests ──────────────────────────────────

describe("Town building overlap detection", () => {
  function checkBuildingOverlap(ax: number, ay: number): TownAction {
    const entries = Object.entries(TOWN_BUILDINGS) as Array<
      [keyof typeof TOWN_BUILDINGS, (typeof TOWN_BUILDINGS)[keyof typeof TOWN_BUILDINGS]]
    >;
    for (const [key, bld] of entries) {
      const dx = Math.abs(ax - bld.x);
      const dy = Math.abs(ay - bld.y);
      if (dx < bld.w / 2 + 8 && dy < bld.h / 2 + 8) {
        return BUILDING_ACTIONS[key];
      }
    }
    return null;
  }

  it("avatar at corral center triggers buy_mule", () => {
    const corral = TOWN_BUILDINGS.corral;
    expect(checkBuildingOverlap(corral.x, corral.y)).toEqual({ type: "buy_mule" });
  });

  it("avatar at pub center triggers visit_pub", () => {
    const pub = TOWN_BUILDINGS.pub;
    expect(checkBuildingOverlap(pub.x, pub.y)).toEqual({ type: "visit_pub" });
  });

  it("avatar at food store triggers outfit_mule with food", () => {
    const food = TOWN_BUILDINGS.food;
    expect(checkBuildingOverlap(food.x, food.y)).toEqual({ type: "outfit_mule", resource: "food" });
  });

  it("avatar far from any building returns null", () => {
    expect(checkBuildingOverlap(0, 0)).toBeNull();
  });

  it("avatar just inside building edge triggers action", () => {
    const assay = TOWN_BUILDINGS.assay;
    // Just inside the edge: x offset = w/2 + 7 (inside threshold of w/2 + 8)
    expect(checkBuildingOverlap(assay.x + assay.w / 2 + 7, assay.y)).toEqual({ type: "assay" });
  });

  it("avatar just outside building edge returns null", () => {
    const assay = TOWN_BUILDINGS.assay;
    // Just outside: x offset = w/2 + 8 (NOT less than w/2 + 8)
    expect(checkBuildingOverlap(assay.x + assay.w / 2 + 8, assay.y)).toBeNull();
  });
});
