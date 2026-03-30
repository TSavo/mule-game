import { describe, it, expect } from "vitest";
import { ProductionPhase } from "../src/phases/ProductionPhase.js";
import { RandomEventPhase } from "../src/phases/RandomEventPhase.js";
import { GameState } from "../src/state/GameState.js";
import { PlayerSchema } from "../src/state/PlayerSchema.js";
import { TileSchema } from "../src/state/TileSchema.js";
import { SeededRNG } from "@mule-game/shared";

const testRng = new SeededRNG(42);

function setupState(): GameState {
  const state = new GameState();
  for (let i = 0; i < 2; i++) {
    const p = new PlayerSchema();
    p.index = i; p.name = `P${i}`; p.money = i === 0 ? 1000 : 2000;
    p.food = 4; p.energy = 4;
    state.players.set(String(i), p);
  }
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 9; c++) {
      const t = new TileSchema();
      t.row = r; t.col = c; t.terrain = "plains";
      state.tiles.push(t);
    }
  }
  return state;
}

describe("ProductionPhase", () => {
  it("runs production and updates resources", () => {
    const state = setupState();
    // Use energy on plains (plains energy quality=4, produces well)
    const tile0 = state.tiles.at(0)!;
    tile0.owner = 0;
    tile0.installedMule = "energy";
    state.players.get("0")!.energy = 1; // need energy to power the M.U.L.E.
    new ProductionPhase().execute(state, 1, testRng);
    // Energy M.U.L.E. on plains should produce (quality 4 = 7 units, minus 1 consumed)
    expect(state.players.get("0")!.energy).toBeGreaterThan(0);
  });
});

describe("RandomEventPhase", () => {
  it("selects and applies an event", () => {
    const state = setupState();
    // Seed 7: first RNG value ~0.012 which is ≤ 0.275 (event probability), so event always fires
    new RandomEventPhase().execute(state, new SeededRNG(7), 1);
    expect(state.eventMessage).not.toBe("");
  });
});
