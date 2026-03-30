import { describe, it, expect } from "vitest";
import { GameState } from "../src/state/GameState.js";
import { PlayerSchema } from "../src/state/PlayerSchema.js";
import { TileSchema } from "../src/state/TileSchema.js";
import { StoreSchema } from "../src/state/StoreSchema.js";

describe("GameState", () => {
  it("initializes with default values", () => {
    const state = new GameState();
    expect(state.round).toBe(0);
    expect(state.phase).toBe("land_grant");
    expect(state.players.size).toBe(0);
    expect(state.tiles.length).toBe(0);
  });
});

describe("PlayerSchema", () => {
  it("initializes from player data", () => {
    const player = new PlayerSchema();
    player.index = 0;
    player.name = "Test";
    player.money = 1000;
    player.food = 4;
    player.energy = 2;
    expect(player.money).toBe(1000);
    expect(player.food).toBe(4);
  });
});

describe("TileSchema", () => {
  it("initializes tile state", () => {
    const tile = new TileSchema();
    tile.row = 2;
    tile.col = 4;
    tile.terrain = "town";
    expect(tile.terrain).toBe("town");
    expect(tile.owner).toBe(-1);
  });
});

describe("StoreSchema", () => {
  it("initializes store with starting inventory", () => {
    const store = new StoreSchema();
    expect(store.food).toBe(8);
    expect(store.muleCount).toBe(14);
  });
});
