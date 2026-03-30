import { describe, it, expect } from "vitest";
import { AIPlayer } from "../src/ai/AIPlayer.js";
import { GameState } from "../src/state/GameState.js";
import { PlayerSchema } from "../src/state/PlayerSchema.js";
import { TileSchema } from "../src/state/TileSchema.js";
import { SeededRNG, MAP_ROWS, MAP_COLS, TOWN_ROW, TOWN_COL } from "@mule-game/shared";

function setupState(): GameState {
  const state = new GameState();
  for (let i = 0; i < 4; i++) {
    const p = new PlayerSchema();
    p.index = i; p.name = `P${i}`; p.money = 1000; p.food = 4; p.energy = 2;
    p.isAI = i > 0; p.aiDifficulty = i > 0 ? "standard" : "";
    state.players.set(String(i), p);
  }
  for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) {
    const t = new TileSchema();
    t.row = r; t.col = c;
    t.terrain = r === TOWN_ROW && c === TOWN_COL ? "town" : c === 4 ? "river" : "plains";
    state.tiles.push(t);
  }
  state.store.muleCount = 14; state.store.mulePrice = 100;
  state.auction.buyTick = 0; state.auction.sellTick = 100;
  state.auction.resource = "food";
  return state;
}

describe("AIPlayer", () => {
  it("chooses a plot during land grant", () => {
    const ai = new AIPlayer(1, "standard");
    const d = ai.decideLandGrant(setupState(), new SeededRNG(42));
    expect(d).not.toBeNull();
    expect(d!.row).toBeGreaterThanOrEqual(0);
  });

  it("decides development actions with empty plot", () => {
    const state = setupState();
    state.tiles.find((t: any) => t.row === 0 && t.col === 0)!.owner = 1;
    const actions = new AIPlayer(1, "standard").decideDevelopment(state, new SeededRNG(42), 1);
    expect(actions.some(a => a.type === "buy_mule")).toBe(true);
  });

  it("visits pub when no empty plots", () => {
    const actions = new AIPlayer(1, "standard").decideDevelopment(setupState(), new SeededRNG(42), 1);
    expect(actions.some(a => a.type === "visit_pub")).toBe(true);
  });

  it("declares seller when food surplus", () => {
    const state = setupState();
    state.players.get("1")!.food = 10;
    expect(new AIPlayer(1, "standard").decideAuctionRole(state, new SeededRNG(42))).toBe("seller");
  });

  it("declares buyer when food shortage", () => {
    const state = setupState();
    state.players.get("1")!.food = 0;
    expect(new AIPlayer(1, "standard").decideAuctionRole(state, new SeededRNG(42))).toBe("buyer");
  });
});
