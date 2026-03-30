import type { MapTile, CrystiteLevel, ProductionResult } from "./types.js";
import { TerrainType, ResourceType } from "./types.js";
import { PRODUCTION_QUALITY, QUALITY_TO_UNITS, ADJACENCY_BONUS } from "./constants.js";

const MAX_OUTPUT = 8;

const CRYSTITE_LEVEL_TO_QUALITY: Record<CrystiteLevel, number> = {
  none: 0, low: 2, medium: 3, high: 4,
};

export function getProductionQuality(
  terrain: TerrainType, resource: ResourceType, crystiteLevel: CrystiteLevel = "none", smithoreLevel: number = 0
): number {
  if (resource === ResourceType.Crystite) {
    if (terrain === TerrainType.River || terrain === TerrainType.Town) return 0;
    return CRYSTITE_LEVEL_TO_QUALITY[crystiteLevel];
  }
  // Use per-tile smithore level when available (overrides terrain-based quality)
  if (resource === ResourceType.Smithore && smithoreLevel > 0) {
    return smithoreLevel;
  }
  return PRODUCTION_QUALITY[terrain]?.[resource] ?? 0;
}

export function calculateAdjacencyBonus(
  tiles: MapTile[][], row: number, col: number, playerIndex: number
): number {
  const tile = tiles[row]?.[col];
  if (!tile || !tile.installedMule || tile.owner !== playerIndex) return 0;
  const resource = tile.installedMule;

  const visited = new Set<string>();
  const queue: Array<{ r: number; c: number }> = [{ r: row, c: col }];
  visited.add(`${row},${col}`);

  while (queue.length > 0) {
    const { r, c } = queue.shift()!;
    for (const n of [{ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 }]) {
      const key = `${n.r},${n.c}`;
      if (visited.has(key)) continue;
      if (n.r < 0 || n.r >= tiles.length || n.c < 0 || n.c >= (tiles[0]?.length ?? 0)) continue;
      const neighbor = tiles[n.r][n.c];
      if (neighbor.owner === playerIndex && neighbor.installedMule === resource) {
        visited.add(key);
        queue.push(n);
      }
    }
  }

  const groupSize = visited.size;
  return ADJACENCY_BONUS[groupSize] ?? ADJACENCY_BONUS[9] ?? 0;
}

export function calculateTileProduction(
  tile: MapTile, allTiles: MapTile[][], playerIndex: number, energyLevel: number, species?: string, rngValue?: number
): ProductionResult {
  const resource = tile.installedMule;
  if (!resource || tile.owner !== playerIndex) {
    return {
      tile: { row: tile.row, col: tile.col },
      resource: resource ?? ResourceType.Food,
      baseOutput: 0,
      adjacencyBonus: 0,
      energyModifier: 0,
      finalOutput: 0,
    };
  }
  const quality = getProductionQuality(tile.terrain, resource, tile.crystiteLevel, tile.smithoreLevel ?? 0);
  const baseOutput = QUALITY_TO_UNITS[quality] ?? 0;
  const adjacencyBonus = calculateAdjacencyBonus(allTiles, tile.row, tile.col, playerIndex);
  const energyModifier = energyLevel;
  const speciesBonus = species === "humanoid" ? 1.25 : 1.0;
  // Gaussian-like variation: rngValue 0-1 mapped to -1, 0, or +1 (Java: normalRandom())
  const variation = rngValue !== undefined ? (rngValue < 0.25 ? -1 : rngValue > 0.75 ? 1 : 0) : 0;
  const rawOutput = Math.floor((baseOutput + adjacencyBonus + variation) * energyModifier * speciesBonus);
  const finalOutput = Math.max(0, Math.min(rawOutput, MAX_OUTPUT));
  return { tile: { row: tile.row, col: tile.col }, resource, baseOutput, adjacencyBonus, energyModifier, finalOutput };
}
