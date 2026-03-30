import { SeededRNG, FOOD_REQUIRED_BY_ROUND, OUTFIT_COST } from "@mule-game/shared";
import type { GameState } from "../state/GameState.js";

export interface AIAction {
  type: "buy_mule" | "outfit_mule" | "install_mule" | "visit_pub" | "end_turn";
  resource?: string;
  row?: number;
  col?: number;
}

export class AIPlayer {
  readonly playerIndex: number;
  readonly difficulty: string;

  constructor(playerIndex: number, difficulty: string) {
    this.playerIndex = playerIndex;
    this.difficulty = difficulty;
  }

  decideLandGrant(state: GameState, rng: SeededRNG): { row: number; col: number } | null {
    const candidates = state.tiles.filter((t: any) => t.owner === -1 && t.terrain !== "town");
    if (candidates.length === 0) return null;
    const scored = candidates.map((t: any) => ({ row: t.row, col: t.col, score: this.scoreTile(t, state) }));
    scored.sort((a: any, b: any) => b.score - a.score);
    if (this.difficulty === "beginner") {
      return scored[rng.nextInt(0, Math.min(scored.length - 1, 9))];
    }
    return scored[rng.nextInt(0, Math.min(2, scored.length - 1))];
  }

  decideDevelopment(state: GameState, rng: SeededRNG, round: number): AIAction[] {
    const actions: AIAction[] = [];
    const player = state.players.get(String(this.playerIndex));
    if (!player) return actions;
    const emptyPlots = state.tiles.filter((t: any) => t.owner === this.playerIndex && t.installedMule === "");
    if (emptyPlots.length > 0 && state.store.muleCount > 0 && player.money >= state.store.mulePrice + 25) {
      const plot = emptyPlots[0];
      const resource = this.chooseResource(plot, state);
      actions.push({ type: "buy_mule" });
      actions.push({ type: "outfit_mule", resource });
      actions.push({ type: "install_mule", row: plot.row, col: plot.col });
    }
    if (actions.length === 0) actions.push({ type: "visit_pub" });
    return actions;
  }

  decideAuctionRole(state: GameState, rng: SeededRNG): "buyer" | "seller" {
    const player = state.players.get(String(this.playerIndex));
    if (!player) return "buyer";
    const resource = state.auction.resource;
    const amount = (player as any)[resource] ?? 0;
    if (resource === "food") {
      const req = FOOD_REQUIRED_BY_ROUND[Math.min(state.round + 1, 12)] ?? 5;
      return amount > req + 2 ? "seller" : "buyer";
    }
    if (resource === "energy") {
      const mules = state.tiles.filter((t: any) => t.owner === this.playerIndex && t.installedMule !== "").length;
      return amount > mules + 2 ? "seller" : "buyer";
    }
    return amount > 2 ? "seller" : "buyer";
  }

  decideAuctionTick(state: GameState, rng: SeededRNG, role: "buyer" | "seller"): number {
    const buy = state.auction.buyTick;
    const sell = state.auction.sellTick;
    const mid = Math.floor((buy + sell) / 2);
    if (role === "seller") return Math.max(sell - 30, mid + rng.nextInt(0, 20));
    return Math.min(buy + 30, mid - rng.nextInt(0, 20));
  }

  private scoreTile(tile: any, state: GameState): number {
    const terrain = tile.terrain as string;
    let score = terrain.startsWith("mountain") ? 3 : terrain === "river" ? 2 : 1;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const n = state.tiles.find((t: any) => t.row === tile.row + dr && t.col === tile.col + dc);
      if (n && n.owner === this.playerIndex) score++;
    }
    return score;
  }

  private chooseResource(tile: any, state: GameState): string {
    const terrain = tile.terrain as string;
    if (terrain === "river") return "food";
    if (terrain.startsWith("mountain")) return "smithore";
    const player = state.players.get(String(this.playerIndex));
    if (player && player.food < 3) return "food";
    return "energy";
  }
}
