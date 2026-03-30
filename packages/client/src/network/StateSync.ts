import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";

export class StateSync extends Phaser.Events.EventEmitter {
  private room: Room;
  private prevPhase: string = "";
  private prevRound: number = -1;
  private prevCursorRow: number = -1;
  private prevCursorCol: number = -1;
  private prevTurn: number = -2;
  private prevTimer: number = -1;
  private prevEventMessage: string = "";
  private prevColonyScore: number = -1;
  private prevWinnerIndex: number = -2;
  private prevWampusVisible: boolean = false;
  private prevWampusRow: number = -1;
  private prevWampusCol: number = -1;
  // Tile/player change detection via serialized snapshot
  private prevTilesSnapshot: string = "";
  private prevPlayersSnapshot: string = "";
  private prevAuctionSnapshot: string = "";

  constructor(room: Room) {
    super();
    this.room = room;
  }

  /** Call this every frame from MapScene.update() */
  poll(): void {
    const state = this.room?.state;
    if (!state) return;

    const phase: string = state.phase ?? "";
    const round: number = state.round ?? 0;
    const cursorRow: number = state.landGrantCursorRow ?? 0;
    const cursorCol: number = state.landGrantCursorCol ?? 0;
    const turn: number = state.currentPlayerTurn ?? -1;
    const timer: number = state.turnTimeRemaining ?? 0;
    const eventMsg: string = state.eventMessage ?? "";
    const colonyScore: number = state.colonyScore ?? 0;
    const winnerIndex: number = state.winnerIndex ?? -1;

    if (phase !== this.prevPhase) {
      this.emit("phase_changed", phase, this.prevPhase);
      this.prevPhase = phase;
    }

    if (round !== this.prevRound) {
      this.emit("round_changed", round);
      this.prevRound = round;
    }

    if (cursorRow !== this.prevCursorRow || cursorCol !== this.prevCursorCol) {
      this.emit("cursor_moved", cursorRow, cursorCol);
      this.prevCursorRow = cursorRow;
      this.prevCursorCol = cursorCol;
    }

    if (turn !== this.prevTurn) {
      this.emit("turn_changed", turn);
      this.prevTurn = turn;
    }

    if (timer !== this.prevTimer) {
      this.emit("turn_timer", timer);
      this.prevTimer = timer;
    }

    if (eventMsg && eventMsg !== this.prevEventMessage) {
      this.emit("event_message", eventMsg);
      this.prevEventMessage = eventMsg;
    }

    if (colonyScore !== this.prevColonyScore) {
      this.emit("colony_score", colonyScore);
      this.prevColonyScore = colonyScore;
    }

    if (winnerIndex >= 0 && winnerIndex !== this.prevWinnerIndex) {
      this.emit("winner", winnerIndex);
      this.prevWinnerIndex = winnerIndex;
    }

    // Wampus visibility
    const wampusVisible: boolean = state.wampusVisible ?? false;
    const wampusRow: number = state.wampusRow ?? -1;
    const wampusCol: number = state.wampusCol ?? -1;
    if (wampusVisible !== this.prevWampusVisible || wampusRow !== this.prevWampusRow || wampusCol !== this.prevWampusCol) {
      this.emit("wampus_changed", wampusVisible, wampusRow, wampusCol);
      this.prevWampusVisible = wampusVisible;
      this.prevWampusRow = wampusRow;
      this.prevWampusCol = wampusCol;
    }

    // Tiles: build a lightweight snapshot string for change detection
    if (state.tiles) {
      try {
        let snap = "";
        state.tiles.forEach((t: any) => {
          snap += `${t.row},${t.col},${t.owner},${t.installedMule},${t.crystiteLevel},${t.smithoreLevel ?? 0},${t.crystiteRevealed ?? false},${t.lastProduction ?? 0},${t.hadEnergy ?? true}|`;
        });
        if (snap !== this.prevTilesSnapshot) {
          this.emit("tiles_updated");
          this.prevTilesSnapshot = snap;
        }
      } catch (_) { /* ignore */ }
    }

    // Players: snapshot for change detection
    if (state.players) {
      try {
        let snap = "";
        state.players.forEach((p: any) => {
          snap += `${p.index},${p.money},${p.food},${p.energy},${p.smithore},${p.crystite},${p.plotCount},${p.prevFood ?? 0},${p.prevEnergy ?? 0},${p.prevSmithore ?? 0},${p.prevCrystite ?? 0},${p.spoiledFood ?? 0},${p.spoiledEnergy ?? 0},${p.rank ?? 0},${p.score ?? 0}|`;
        });
        if (snap !== this.prevPlayersSnapshot) {
          this.emit("player_updated");
          this.prevPlayersSnapshot = snap;
        }
      } catch (_) { /* ignore */ }
    }

    // Auction state
    if (state.auction) {
      try {
        const a = state.auction;
        const snap = `${a.resource},${a.active},${a.subPhase},${a.timeRemaining},${a.buyTick},${a.sellTick}`;
        if (snap !== this.prevAuctionSnapshot) {
          this.emit("auction_updated", a);
          this.prevAuctionSnapshot = snap;
        }
      } catch (_) { /* ignore */ }
    }
  }

  getState(): any { return this.room?.state; }
  destroy(): void { this.removeAllListeners(); }
}
