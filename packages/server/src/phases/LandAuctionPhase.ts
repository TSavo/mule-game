import type { GameState } from "../state/GameState.js";
import type { SeededRNG } from "@mule-game/shared";

export class LandAuctionPhase {
  private plotsToAuction: Array<{ row: number; col: number }> = [];
  private currentPlotIndex = 0;
  private bids = new Map<number, number>();
  private minimumBid = 100;

  start(state: GameState, rng: SeededRNG): void {
    const unclaimed = state.tiles.filter((t: any) => t.owner === -1 && t.terrain !== "town");
    const count = Math.min(rng.nextInt(0, 3), unclaimed.length);
    const shuffled = [...unclaimed];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.plotsToAuction = shuffled.slice(0, count).map((t: any) => ({ row: t.row, col: t.col }));
    this.currentPlotIndex = 0;
    this.bids.clear();
  }

  getCurrentPlot(): { row: number; col: number } | null {
    return this.plotsToAuction[this.currentPlotIndex] ?? null;
  }

  placeBid(playerIndex: number, amount: number): boolean {
    if (amount < this.minimumBid) return false;
    const currentBid = this.bids.get(playerIndex) ?? 0;
    if (amount <= currentBid) return false;
    this.bids.set(playerIndex, amount);
    return true;
  }

  resolveCurrentPlot(state: GameState, rng?: SeededRNG, round?: number): { winner: number; price: number } | null {
    if (this.bids.size === 0) return null;
    const highestBid = Math.max(...this.bids.values());
    const tied: number[] = [];
    this.bids.forEach((bid, playerIndex) => {
      if (bid === highestBid) tied.push(playerIndex);
    });

    let winner: number;
    if (tied.length === 1) {
      winner = tied[0];
    } else if (round === 1 && rng) {
      // Round 1: random among tied
      winner = tied[Math.floor(rng.next() * tied.length)];
    } else {
      // Other rounds: worst-ranked player wins (highest rank number = worst)
      winner = tied.reduce((best, idx) => {
        const bestRank = state.players.get(String(best))?.rank ?? 99;
        const thisRank = state.players.get(String(idx))?.rank ?? 99;
        return thisRank > bestRank ? idx : best;
      }, tied[0]);
    }

    const plot = this.plotsToAuction[this.currentPlotIndex];
    const tile = state.tiles.find((t: any) => t.row === plot.row && t.col === plot.col);
    if (tile) {
      tile.owner = winner;
      const player = state.players.get(String(winner));
      if (player) { player.money -= highestBid; player.plotCount += 1; }
    }
    this.bids.clear();
    this.currentPlotIndex += 1;
    return { winner, price: highestBid };
  }

  hasMorePlots(): boolean { return this.currentPlotIndex < this.plotsToAuction.length; }
  isComplete(): boolean { return !this.hasMorePlots(); }
}
