import { describe, it, expect } from "vitest";
import { generateMap } from "../src/map-generator.js";
import { TerrainType, MAP_ROWS, MAP_COLS, TOWN_ROW, TOWN_COL, RIVER_COL } from "../src/types.js";

describe("generateMap", () => {
  const map = generateMap(42);

  it("creates a 5x9 grid", () => {
    expect(map.tiles.length).toBe(MAP_ROWS);
    for (const row of map.tiles) {
      expect(row.length).toBe(MAP_COLS);
    }
  });

  it("places town at center", () => {
    expect(map.tiles[TOWN_ROW][TOWN_COL].terrain).toBe(TerrainType.Town);
  });

  it("places river in center column excluding town", () => {
    for (let r = 0; r < MAP_ROWS; r++) {
      const tile = map.tiles[r][RIVER_COL];
      if (r === TOWN_ROW) {
        expect(tile.terrain).toBe(TerrainType.Town);
      } else {
        expect(tile.terrain).toBe(TerrainType.River);
      }
    }
  });

  it("has 4 river tiles", () => {
    const riverCount = map.tiles.flat().filter((t) => t.terrain === TerrainType.River).length;
    expect(riverCount).toBe(4);
  });

  it("has 6-8 mountain tiles", () => {
    const mountainCount = map.tiles
      .flat()
      .filter((t) =>
        [TerrainType.Mountain1, TerrainType.Mountain2, TerrainType.Mountain3].includes(t.terrain)
      ).length;
    expect(mountainCount).toBeGreaterThanOrEqual(6);
    expect(mountainCount).toBeLessThanOrEqual(8);
  });

  it("fills remaining tiles with plains", () => {
    for (const tile of map.tiles.flat()) {
      expect(
        [
          TerrainType.Plains,
          TerrainType.River,
          TerrainType.SmallWater,
          TerrainType.Mountain1,
          TerrainType.Mountain2,
          TerrainType.Mountain3,
          TerrainType.Town,
        ].includes(tile.terrain)
      ).toBe(true);
    }
  });

  it("does not place mountains on river or town", () => {
    for (const tile of map.tiles.flat()) {
      if (tile.col === RIVER_COL) {
        expect(tile.terrain).not.toBe(TerrainType.Mountain1);
        expect(tile.terrain).not.toBe(TerrainType.Mountain2);
        expect(tile.terrain).not.toBe(TerrainType.Mountain3);
      }
    }
  });

  it("is deterministic — same seed produces same map", () => {
    const map1 = generateMap(42);
    const map2 = generateMap(42);
    expect(map1.tiles).toEqual(map2.tiles);
  });

  it("different seeds produce different maps", () => {
    const map1 = generateMap(42);
    const map2 = generateMap(99);
    const terrains1 = map1.tiles.flat().map((t) => t.terrain);
    const terrains2 = map2.tiles.flat().map((t) => t.terrain);
    expect(terrains1).not.toEqual(terrains2);
  });

  it("sets all tiles to unowned with no installed mule", () => {
    for (const tile of map.tiles.flat()) {
      expect(tile.owner).toBeNull();
      if (tile.terrain !== TerrainType.Town) {
        expect(tile.installedMule).toBeNull();
      }
    }
  });

  it("assigns crystite levels to non-river non-town tiles", () => {
    const tilesWithCrystite = map.tiles
      .flat()
      .filter((t) => t.crystiteLevel !== "none" && t.terrain !== TerrainType.River && t.terrain !== TerrainType.Town);
    expect(tilesWithCrystite.length).toBeGreaterThanOrEqual(3);
    expect(tilesWithCrystite.length).toBeLessThanOrEqual(10);
  });

  it("does not place crystite on river tiles", () => {
    for (const tile of map.tiles.flat()) {
      if (tile.terrain === TerrainType.River) {
        expect(tile.crystiteLevel).toBe("none");
      }
    }
  });
});
