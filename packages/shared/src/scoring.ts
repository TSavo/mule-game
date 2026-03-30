import type { Player, PlayerScore, ColonyScore } from "./types.js";
import { LAND_VALUE, COLONY_THRESHOLDS, POINTS_PER_MULE, OUTFIT_COST } from "./constants.js";

interface ResourcePrices {
  food: number;
  energy: number;
  smithore: number;
  crystite: number;
}

export function calculatePlayerScore(
  player: Player,
  prices: ResourcePrices,
  tiles?: Array<{ owner: number | null; installedMule: string | null }>,
): PlayerScore {
  const landValue = player.ownedPlots.length * LAND_VALUE;
  let muleValue = 0;
  if (tiles) {
    for (const tile of tiles) {
      if (tile.owner === player.index && tile.installedMule) {
        muleValue +=
          POINTS_PER_MULE +
          (OUTFIT_COST[tile.installedMule as keyof typeof OUTFIT_COST] ?? 0);
      }
    }
  }
  const goodsValue =
    player.inventory.food * prices.food +
    player.inventory.energy * prices.energy +
    player.inventory.smithore * prices.smithore +
    player.inventory.crystite * prices.crystite +
    muleValue;
  return {
    playerIndex: player.index,
    money: player.money,
    landValue,
    goodsValue,
    totalScore: player.money + landValue + goodsValue,
  };
}

export function calculateColonyScore(
  players: Player[],
  prices: ResourcePrices,
  tiles?: Array<{ owner: number | null; installedMule: string | null }>,
  totalRounds: number = 12,
): ColonyScore {
  const total = players.reduce((sum, p) => sum + calculatePlayerScore(p, prices, tiles).totalScore, 0);
  // Java reference: threshold = 20000 * lastRound / 12, rating = colonyTotal / threshold
  const threshold = Math.floor(20000 * totalRounds / 12);
  const ratingIndex = threshold > 0 ? Math.floor(total / threshold) : 0;
  let rating: ColonyScore["rating"];
  if (ratingIndex >= 3) rating = "first_founder";
  else if (ratingIndex >= 2) rating = "pioneer";
  else if (ratingIndex >= 1) rating = "settler";
  else rating = "failure";
  return { total, rating };
}

export function determineWinner(
  players: Player[],
  prices: ResourcePrices,
  tiles?: Array<{ owner: number | null; installedMule: string | null }>,
): PlayerScore {
  const scores = players.map((p) => calculatePlayerScore(p, prices, tiles));
  scores.sort((a, b) =>
    b.totalScore !== a.totalScore ? b.totalScore - a.totalScore : b.playerIndex - a.playerIndex,
  );
  return scores[0];
}
