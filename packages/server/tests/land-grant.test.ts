import { describe, it, expect } from "vitest";
import { LandGrantPhase } from "../src/phases/LandGrantPhase.js";
import { GameState } from "../src/state/GameState.js";
import { PlayerSchema } from "../src/state/PlayerSchema.js";
import { TileSchema } from "../src/state/TileSchema.js";
import { MAP_ROWS, MAP_COLS, TOWN_ROW, TOWN_COL } from "@mule-game/shared";

function setupState(): GameState {
  const state = new GameState();
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const tile = new TileSchema();
      tile.row = r; tile.col = c;
      tile.terrain = r === TOWN_ROW && c === TOWN_COL ? "town" : "plains";
      state.tiles.push(tile);
    }
  }
  for (let i = 0; i < 4; i++) {
    const p = new PlayerSchema();
    p.index = i; p.name = `Player${i}`;
    state.players.set(String(i), p);
  }
  return state;
}

describe("LandGrantPhase", () => {
  it("starts cursor at 0,0", () => {
    const state = setupState();
    const phase = new LandGrantPhase();
    phase.start(state);
    expect(state.landGrantCursorRow).toBe(0);
    expect(state.landGrantCursorCol).toBe(0);
    expect(state.landGrantActive).toBe(true);
  });

  it("advances cursor through grid", () => {
    const state = setupState();
    const phase = new LandGrantPhase();
    phase.start(state);
    phase.advanceCursor(state);
    expect(state.landGrantCursorCol).toBe(1);
  });

  it("wraps cursor to next row", () => {
    const state = setupState();
    const phase = new LandGrantPhase();
    phase.start(state);
    state.landGrantCursorCol = MAP_COLS - 1;
    phase.advanceCursor(state);
    expect(state.landGrantCursorRow).toBe(1);
    expect(state.landGrantCursorCol).toBe(0);
  });

  it("allows player to claim unclaimed plot", () => {
    const state = setupState();
    const phase = new LandGrantPhase();
    phase.start(state);
    state.landGrantCursorRow = 0; state.landGrantCursorCol = 1;
    expect(phase.claimPlot(state, 0)).toBe(true);
    const tile = state.tiles.find((t: any) => t.row === 0 && t.col === 1)!;
    expect(tile.owner).toBe(0);
  });

  it("rejects claim on already owned plot", () => {
    const state = setupState();
    const phase = new LandGrantPhase();
    phase.start(state);
    state.landGrantCursorRow = 0; state.landGrantCursorCol = 1;
    phase.claimPlot(state, 0);
    expect(phase.claimPlot(state, 1)).toBe(false);
  });

  it("rejects claim on town tile", () => {
    const state = setupState();
    const phase = new LandGrantPhase();
    phase.start(state);
    state.landGrantCursorRow = TOWN_ROW; state.landGrantCursorCol = TOWN_COL;
    expect(phase.claimPlot(state, 0)).toBe(false);
  });

  it("each player can only claim once per round", () => {
    const state = setupState();
    const phase = new LandGrantPhase();
    phase.start(state);
    state.landGrantCursorRow = 0; state.landGrantCursorCol = 0;
    phase.claimPlot(state, 0);
    state.landGrantCursorRow = 0; state.landGrantCursorCol = 1;
    expect(phase.claimPlot(state, 0)).toBe(false);
  });

  it("ends when cursor passes last tile", () => {
    const state = setupState();
    const phase = new LandGrantPhase();
    phase.start(state);
    state.landGrantCursorRow = MAP_ROWS - 1;
    state.landGrantCursorCol = MAP_COLS - 1;
    phase.advanceCursor(state);
    expect(state.landGrantActive).toBe(false);
  });
});
