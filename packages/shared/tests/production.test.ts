import { describe, it, expect } from "vitest";
import { calculateTileProduction, calculateAdjacencyBonus, getProductionQuality } from "../src/production.js";
import { TerrainType, ResourceType } from "../src/types.js";
import type { MapTile } from "../src/types.js";

function makeTile(overrides: Partial<MapTile> = {}): MapTile {
  return {
    row: 0, col: 0, terrain: TerrainType.Plains, crystiteLevel: "none",
    smithoreLevel: 0, owner: null, installedMule: null, ...overrides,
  };
}

describe("getProductionQuality", () => {
  it("river + food = 4 (high)", () => {
    expect(getProductionQuality(TerrainType.River, ResourceType.Food)).toBe(4);
  });
  it("river + smithore = 0 (no mining on river)", () => {
    expect(getProductionQuality(TerrainType.River, ResourceType.Smithore)).toBe(0);
  });
  it("plains + energy = 4 (high)", () => {
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Energy)).toBe(4);
  });
  it("mountain3 + smithore = 4 (high)", () => {
    expect(getProductionQuality(TerrainType.Mountain3, ResourceType.Smithore)).toBe(4);
  });
  it("mountain1 + energy = 1 (poor)", () => {
    expect(getProductionQuality(TerrainType.Mountain1, ResourceType.Energy)).toBe(1);
  });
  it("plains + crystite uses crystiteLevel not terrain", () => {
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Crystite, "high")).toBe(4);
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Crystite, "medium")).toBe(3);
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Crystite, "low")).toBe(2);
    expect(getProductionQuality(TerrainType.Plains, ResourceType.Crystite, "none")).toBe(0);
  });
});

describe("calculateAdjacencyBonus", () => {
  it("returns 0 for a single tile", () => {
    const tiles: MapTile[][] = [[makeTile({ installedMule: ResourceType.Food, owner: 0 })]];
    expect(calculateAdjacencyBonus(tiles, 0, 0, 0)).toBe(0);
  });
  it("returns bonus for 2 adjacent same-resource tiles", () => {
    const tiles: MapTile[][] = [[
      makeTile({ row: 0, col: 0, installedMule: ResourceType.Food, owner: 0 }),
      makeTile({ row: 0, col: 1, installedMule: ResourceType.Food, owner: 0 }),
    ]];
    expect(calculateAdjacencyBonus(tiles, 0, 0, 0)).toBe(1);
  });
  it("returns 0 for adjacent different-resource tiles", () => {
    const tiles: MapTile[][] = [[
      makeTile({ row: 0, col: 0, installedMule: ResourceType.Food, owner: 0 }),
      makeTile({ row: 0, col: 1, installedMule: ResourceType.Energy, owner: 0 }),
    ]];
    expect(calculateAdjacencyBonus(tiles, 0, 0, 0)).toBe(0);
  });
  it("returns 0 for adjacent same-resource tiles owned by different player", () => {
    const tiles: MapTile[][] = [[
      makeTile({ row: 0, col: 0, installedMule: ResourceType.Food, owner: 0 }),
      makeTile({ row: 0, col: 1, installedMule: ResourceType.Food, owner: 1 }),
    ]];
    expect(calculateAdjacencyBonus(tiles, 0, 0, 0)).toBe(0);
  });
});

describe("calculateTileProduction", () => {
  it("produces max output for ideal terrain match with full energy", () => {
    const tile = makeTile({ terrain: TerrainType.River, installedMule: ResourceType.Food, owner: 0 });
    const result = calculateTileProduction(tile, [[tile]], 0, 1.0);
    expect(result.baseOutput).toBe(4);
    expect(result.energyModifier).toBe(1);
    expect(result.finalOutput).toBe(4);
  });
  it("produces 0 for smithore on river", () => {
    const tile = makeTile({ terrain: TerrainType.River, installedMule: ResourceType.Smithore, owner: 0 });
    const result = calculateTileProduction(tile, [[tile]], 0, 1.0);
    expect(result.finalOutput).toBe(0);
  });
  it("produces half output when unpowered (partial power)", () => {
    const tile = makeTile({ terrain: TerrainType.Plains, installedMule: ResourceType.Energy, owner: 0 });
    const result = calculateTileProduction(tile, [[tile]], 0, 0.5);
    expect(result.energyModifier).toBe(0.5);
    expect(result.finalOutput).toBe(2); // floor(4 * 0.5) = 2
  });
  it("produces 0 when energyLevel is 0", () => {
    const tile = makeTile({ terrain: TerrainType.Plains, installedMule: ResourceType.Energy, owner: 0 });
    const result = calculateTileProduction(tile, [[tile]], 0, 0);
    expect(result.energyModifier).toBe(0);
    expect(result.finalOutput).toBe(0);
  });
  it("caps output at 8", () => {
    const tiles: MapTile[][] = [
      [makeTile({ row: 0, col: 0, terrain: TerrainType.River, installedMule: ResourceType.Food, owner: 0 })],
      [makeTile({ row: 1, col: 0, terrain: TerrainType.River, installedMule: ResourceType.Food, owner: 0 })],
    ];
    const result = calculateTileProduction(tiles[0][0], tiles, 0, 1.0);
    expect(result.finalOutput).toBeLessThanOrEqual(8);
  });
});
