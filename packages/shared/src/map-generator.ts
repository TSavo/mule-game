import {
  type GameMap,
  type MapTile,
  type CrystiteLevel,
  TerrainType,
  MAP_ROWS,
  MAP_COLS,
  TOWN_ROW,
  TOWN_COL,
  RIVER_COL,
} from "./types.js";
import { MIN_MOUNTAINS, MAX_MOUNTAINS, MIN_CLUSTERS, MAX_CLUSTERS, MIN_CLUSTER_SIZE, MAX_CLUSTER_SIZE } from "./constants.js";
import { SeededRNG } from "./rng.js";

export function generateMap(seed: number): GameMap {
  const rng = new SeededRNG(seed);

  // Initialize grid with plains
  const tiles: MapTile[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: MapTile[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      row.push({
        row: r,
        col: c,
        terrain: TerrainType.Plains,
        crystiteLevel: "none",
        smithoreLevel: 0,
        owner: null,
        installedMule: null,
      });
    }
    tiles.push(row);
  }

  // Place town
  tiles[TOWN_ROW][TOWN_COL].terrain = TerrainType.Town;

  // Place river (center column, excluding town)
  for (let r = 0; r < MAP_ROWS; r++) {
    if (r !== TOWN_ROW) {
      tiles[r][RIVER_COL].terrain = TerrainType.River;
    }
  }

  // Place small water tiles adjacent to river (30% chance per eligible neighbor)
  for (let r = 0; r < MAP_ROWS; r++) {
    for (const dc of [-1, 1]) {
      const c = RIVER_COL + dc;
      if (c >= 0 && c < MAP_COLS && tiles[r][c].terrain === TerrainType.Plains) {
        if (rng.next() < 0.3) {
          tiles[r][c].terrain = TerrainType.SmallWater;
        }
      }
    }
  }

  // Collect eligible tiles for mountains (not river, not town, not small_water)
  const eligible: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (tiles[r][c].terrain === TerrainType.Plains) {
        eligible.push({ row: r, col: c });
      }
    }
  }

  // Place mountains
  const mountainCount = rng.nextInt(MIN_MOUNTAINS, MAX_MOUNTAINS);
  const mountainTypes = [TerrainType.Mountain1, TerrainType.Mountain2, TerrainType.Mountain3];
  const shuffled = rng.shuffle(eligible);

  // Base smithore level by mountain type, plus random +/-1 variation
  const baseSmithore: Record<string, number> = {
    [TerrainType.Mountain1]: 2,
    [TerrainType.Mountain2]: 3,
    [TerrainType.Mountain3]: 4,
  };
  for (let i = 0; i < mountainCount && i < shuffled.length; i++) {
    const { row, col } = shuffled[i];
    const mtype = rng.pick(mountainTypes);
    tiles[row][col].terrain = mtype;
    const base = baseSmithore[mtype] ?? 1;
    const variation = rng.nextInt(-1, 1);
    tiles[row][col].smithoreLevel = Math.max(1, Math.min(4, base + variation));
  }
  // Plains get smithore level 1 (matching PRODUCTION_QUALITY plains smithore=1)
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (tiles[r][c].terrain === TerrainType.Plains) tiles[r][c].smithoreLevel = 1;
    }
  }

  // Place crystite clusters
  placeCrystiteClusters(tiles, rng);

  return { tiles, seed };
}

function placeCrystiteClusters(tiles: MapTile[][], rng: SeededRNG): void {
  const clusterCount = rng.nextInt(MIN_CLUSTERS, MAX_CLUSTERS);

  const eligible: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const terrain = tiles[r][c].terrain;
      if (terrain !== TerrainType.River && terrain !== TerrainType.Town) {
        eligible.push({ row: r, col: c });
      }
    }
  }

  for (let cluster = 0; cluster < clusterCount; cluster++) {
    const clusterSize = rng.nextInt(MIN_CLUSTER_SIZE, MAX_CLUSTER_SIZE);
    const center = rng.pick(eligible);
    const levels: CrystiteLevel[] = ["low", "medium", "high"];

    tiles[center.row][center.col].crystiteLevel = rng.pick(levels);

    let placed = 1;
    const candidates = getNeighbors(center.row, center.col).filter(
      ({ row, col }) =>
        row >= 0 &&
        row < MAP_ROWS &&
        col >= 0 &&
        col < MAP_COLS &&
        tiles[row][col].terrain !== TerrainType.River &&
        tiles[row][col].terrain !== TerrainType.Town
    );

    const shuffledCandidates = rng.shuffle(candidates);
    for (const candidate of shuffledCandidates) {
      if (placed >= clusterSize) break;
      if (tiles[candidate.row][candidate.col].crystiteLevel === "none") {
        tiles[candidate.row][candidate.col].crystiteLevel = rng.pick(levels);
        placed++;
      }
    }
  }
}

function getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
    { row: row - 1, col: col - 1 },
    { row: row - 1, col: col + 1 },
    { row: row + 1, col: col - 1 },
    { row: row + 1, col: col + 1 },
  ];
}
