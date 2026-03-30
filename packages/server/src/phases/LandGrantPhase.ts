import { MAP_ROWS, MAP_COLS, TOWN_ROW, TOWN_COL } from "@mule-game/shared";
import type { GameState } from "../state/GameState.js";

export class LandGrantPhase {
  private claimedThisRound = new Set<number>();

  start(state: GameState): void {
    state.landGrantCursorRow = 0;
    state.landGrantCursorCol = 0;
    state.landGrantActive = true;
    this.claimedThisRound.clear();
  }

  advanceCursor(state: GameState): void {
    let col = state.landGrantCursorCol + 1;
    let row = state.landGrantCursorRow;
    if (col >= MAP_COLS) { col = 0; row += 1; }
    if (row >= MAP_ROWS) { state.landGrantActive = false; return; }
    state.landGrantCursorRow = row;
    state.landGrantCursorCol = col;
  }

  claimPlot(state: GameState, playerIndex: number): boolean {
    if (!state.landGrantActive) return false;
    if (this.claimedThisRound.has(playerIndex)) return false;
    const row = state.landGrantCursorRow;
    const col = state.landGrantCursorCol;
    if (row === TOWN_ROW && col === TOWN_COL) return false;
    const tile = state.tiles.find((t: any) => t.row === row && t.col === col);
    if (!tile || tile.owner !== -1) return false;
    tile.owner = playerIndex;
    this.claimedThisRound.add(playerIndex);
    const player = state.players.get(String(playerIndex));
    if (player) player.plotCount += 1;
    return true;
  }

  isComplete(state: GameState): boolean { return !state.landGrantActive; }
  reset(): void { this.claimedThisRound.clear(); }
}
