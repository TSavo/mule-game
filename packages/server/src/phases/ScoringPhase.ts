import { calculatePlayerScore, calculateColonyScore, determineWinner, ROUNDS_BY_MODE, GameMode } from "@mule-game/shared";
import type { Player } from "@mule-game/shared";
import { EconomyEngine } from "../economy/EconomyEngine.js";
import type { GameState } from "../state/GameState.js";

export class ScoringPhase {
  private engine = new EconomyEngine();

  execute(state: GameState): void {
    const prices = {
      food: state.store.foodSellPrice,
      energy: state.store.energySellPrice,
      smithore: state.store.smithoreSellPrice,
      crystite: state.store.crystiteSellPrice,
    };

    const players: Player[] = [];
    state.players.forEach((p: any) => {
      const ownedPlots: Array<{ row: number; col: number }> = [];
      state.tiles.forEach((t: any) => { if (t.owner === p.index) ownedPlots.push({ row: t.row, col: t.col }); });
      players.push({
        index: p.index, name: p.name, species: p.species as any, color: p.color as any,
        money: p.money, inventory: { food: p.food, energy: p.energy, smithore: p.smithore, crystite: p.crystite },
        ownedPlots, isAI: p.isAI, aiDifficulty: p.aiDifficulty as any,
      });
    });

    const tiles: Array<{ owner: number | null; installedMule: string | null }> = [];
    state.tiles.forEach((t: any) => {
      tiles.push({
        owner: t.owner === -1 ? null : t.owner,
        installedMule: t.installedMule || null,
      });
    });

    const totalRounds = ROUNDS_BY_MODE[state.mode as GameMode] ?? 12;
    const colony = calculateColonyScore(players, prices, tiles, totalRounds);
    state.colonyScore = colony.total;
    state.colonyRating = colony.rating;
    state.winnerIndex = determineWinner(players, prices, tiles).playerIndex;

    const scores = players.map((p) => calculatePlayerScore(p, prices, tiles));
    scores.sort((a, b) =>
      b.totalScore !== a.totalScore ? b.totalScore - a.totalScore : b.playerIndex - a.playerIndex,
    );
    scores.forEach((s, i) => {
      const player = state.players.get(String(s.playerIndex));
      if (player) {
        player.score = s.totalScore;
        player.rank = i + 1;
      }
    });

    if (this.engine.checkColonyDeath(state)) {
      state.phase = "game_over";
      state.colonyRating = "failure";
    }
  }
}
