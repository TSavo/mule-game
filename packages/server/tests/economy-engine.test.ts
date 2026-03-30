import { describe, it, expect } from "vitest";
import { EconomyEngine } from "../src/economy/EconomyEngine.js";
import { GameState } from "../src/state/GameState.js";
import { PlayerSchema } from "../src/state/PlayerSchema.js";
import { TileSchema } from "../src/state/TileSchema.js";
import { SeededRNG } from "@mule-game/shared";

function setupGameState(): GameState {
  const state = new GameState();
  const player = new PlayerSchema();
  player.index = 0;
  player.name = "Player1";
  player.money = 1000;
  player.food = 4;
  player.energy = 4;
  player.smithore = 0;
  player.crystite = 0;
  state.players.set("0", player);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const tile = new TileSchema();
      tile.row = r;
      tile.col = c;
      tile.terrain = "plains";
      state.tiles.push(tile);
    }
  }
  return state;
}

describe("EconomyEngine", () => {
  it("runs production and updates player inventory", () => {
    const state = setupGameState();
    // Use river terrain for food (plains produces 0 food per Planet M.U.L.E.)
    const tile0 = state.tiles.at(0)!;
    tile0.terrain = "river";
    tile0.owner = 0;
    tile0.installedMule = "food";
    const engine = new EconomyEngine();
    engine.runProduction(state, 1, new SeededRNG(42));
    expect(state.players.get("0")!.food).toBeGreaterThan(4);
  });

  it("applies spoilage to player inventories", () => {
    const state = setupGameState();
    state.players.get("0")!.food = 20;
    const engine = new EconomyEngine();
    engine.applySpoilage(state);
    expect(state.players.get("0")!.food).toBeLessThan(20);
  });

  it("manufactures M.U.L.E.s from smithore in store", () => {
    const state = setupGameState();
    state.store.smithore = 4;
    state.store.muleCount = 5;
    const engine = new EconomyEngine();
    engine.manufactureMules(state);
    expect(state.store.muleCount).toBeGreaterThan(5);
    expect(state.store.smithore).toBeLessThan(4);
  });

  it("mule price is always flat $100", () => {
    const state = setupGameState();
    state.store.muleCount = 3;
    state.store.smithore = 0;
    const engine = new EconomyEngine();
    engine.updateMulePrice(state);
    expect(state.store.mulePrice).toBe(100);
  });

  it("detects colony death when no food anywhere", () => {
    const state = setupGameState();
    state.players.get("0")!.food = 0;
    state.store.food = 0;
    const engine = new EconomyEngine();
    expect(engine.checkColonyDeath(state)).toBe(true);
  });

  it("no colony death when store has food", () => {
    const state = setupGameState();
    state.players.get("0")!.food = 0;
    state.store.food = 5;
    const engine = new EconomyEngine();
    expect(engine.checkColonyDeath(state)).toBe(false);
  });
});
