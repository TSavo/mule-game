import {
  calculateTileProduction,
  calculateSpoilage,
  calculateMuleAvailability,
  calculateMulePrice,
  calculateDynamicPrices,
  ENERGY_COST_PER_MULE,
  TerrainType,
  ResourceType,
} from "@mule-game/shared";
import type { MapTile, ResourceInventory } from "@mule-game/shared";
import type { SeededRNG } from "@mule-game/shared";
import type { GameState } from "../state/GameState.js";

export class EconomyEngine {
  runProduction(state: GameState, round: number, rng: SeededRNG): void {
    const tileGrid = this.buildTileGrid(state);

    // Reset per-tile production tracking
    state.tiles.forEach((t) => { t.lastProduction = 0; t.hadEnergy = true; });

    state.players.forEach((player) => {
      const playerIndex = player.index;
      const playerTiles = state.tiles.filter(
        (t) => t.owner === playerIndex && t.installedMule !== ""
      );

      const energyNeeded = playerTiles.reduce(
        (sum, t) => sum + (ENERGY_COST_PER_MULE[t.installedMule] ?? 1),
        0,
      );
      const energyAvailable = player.energy;
      const energyDeficit = Math.max(0, energyNeeded - energyAvailable);
      player.energy = Math.max(0, player.energy - energyNeeded);

      const mulesWithEnergy = playerTiles.length - energyDeficit;

      // Shuffle tiles using seeded RNG before energy allocation (matches Planet M.U.L.E. behavior)
      const shuffledTiles = [...playerTiles];
      for (let i = shuffledTiles.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [shuffledTiles[i], shuffledTiles[j]] = [shuffledTiles[j], shuffledTiles[i]];
      }

      shuffledTiles.forEach((tile, i) => {
        // Fully powered MULEs get 1.0, unpowered MULEs produce at half rate (0.5)
        const energyLevel = i < mulesWithEnergy ? 1.0 : 0.5;
        const mapTile = tileGrid[tile.row]?.[tile.col];
        if (!mapTile) return;

        const result = calculateTileProduction(mapTile, tileGrid, playerIndex, energyLevel, player.species, rng.next());

        // Update per-tile production tracking on the schema tile
        const schemaTile = state.tiles.find((t) => t.row === tile.row && t.col === tile.col);
        if (schemaTile) {
          schemaTile.lastProduction = result.finalOutput;
          schemaTile.hadEnergy = energyLevel >= 1.0;
        }

        switch (tile.installedMule) {
          case "food": player.food += result.finalOutput; break;
          case "energy": player.energy += result.finalOutput; break;
          case "smithore": player.smithore += result.finalOutput; break;
          case "crystite": player.crystite += result.finalOutput; break;
        }
      });
    });
  }

  snapshotPreProduction(state: GameState): void {
    state.players.forEach((player) => {
      player.prevFood = player.food;
      player.prevEnergy = player.energy;
      player.prevSmithore = player.smithore;
      player.prevCrystite = player.crystite;
    });
  }

  applySpoilage(state: GameState): void {
    // Check who owns the town tile (depot) — they're immune to spoilage
    const townTile = state.tiles.find((t) => t.terrain === "town");
    const depotOwner = townTile ? townTile.owner : -1;

    state.players.forEach((player) => {
      if (player.index === depotOwner) {
        player.spoiledFood = 0;
        player.spoiledEnergy = 0;
        return;
      }
      const inventory: ResourceInventory = {
        food: player.food, energy: player.energy,
        smithore: player.smithore, crystite: player.crystite,
      };
      const result = calculateSpoilage(inventory);
      player.spoiledFood = player.food - result.food;
      player.spoiledEnergy = player.energy - result.energy;
      player.food = result.food;
      player.energy = result.energy;
      player.smithore = result.smithore;
      player.crystite = result.crystite;
    });
  }

  manufactureMules(state: GameState): void {
    const result = calculateMuleAvailability(state.store.muleCount, state.store.smithore);
    state.store.muleCount = result.newMuleCount;
    state.store.smithore -= result.smithoreConsumed;
  }

  updateMulePrice(state: GameState): void {
    state.store.mulePrice = calculateMulePrice(state.store.muleCount, state.store.smithore);
  }

  /** Recalculate store buy/sell prices for all resources based on supply/demand. */
  updateStorePrices(state: GameState): void {
    const resources = [ResourceType.Food, ResourceType.Energy, ResourceType.Smithore, ResourceType.Crystite] as const;

    for (const resource of resources) {
      // Sum all player stock for this resource
      let totalPlayerStock = 0;
      state.players.forEach((p) => {
        totalPlayerStock += (p as any)[resource] ?? 0;
      });

      const storeStock: number = (state.store as any)[resource] ?? 0;
      const { buyPrice, sellPrice } = calculateDynamicPrices(resource, storeStock, totalPlayerStock);

      switch (resource) {
        case ResourceType.Food:
          state.store.foodBuyPrice = buyPrice;
          state.store.foodSellPrice = sellPrice;
          break;
        case ResourceType.Energy:
          state.store.energyBuyPrice = buyPrice;
          state.store.energySellPrice = sellPrice;
          break;
        case ResourceType.Smithore:
          state.store.smithoreBuyPrice = buyPrice;
          state.store.smithoreSellPrice = sellPrice;
          break;
        case ResourceType.Crystite:
          state.store.crystiteBuyPrice = buyPrice;
          state.store.crystiteSellPrice = sellPrice;
          break;
      }
    }
  }

  checkColonyDeath(state: GameState): boolean {
    let totalFood = state.store.food;
    let totalEnergy = state.store.energy;
    state.players.forEach((p) => {
      totalFood += p.food;
      totalEnergy += p.energy;
    });
    return totalFood === 0 || totalEnergy === 0;
  }

  private buildTileGrid(state: GameState): MapTile[][] {
    const grid: MapTile[][] = [];
    for (let r = 0; r < 5; r++) {
      grid[r] = [];
      for (let c = 0; c < 9; c++) {
        grid[r][c] = {
          row: r, col: c, terrain: TerrainType.Plains,
          crystiteLevel: "none", smithoreLevel: 0, owner: null, installedMule: null,
        };
      }
    }
    for (const tile of state.tiles) {
      if (grid[tile.row]?.[tile.col]) {
        grid[tile.row][tile.col] = {
          row: tile.row, col: tile.col,
          terrain: tile.terrain as TerrainType,
          crystiteLevel: tile.crystiteLevel as any,
          smithoreLevel: (tile as any).smithoreLevel ?? 0,
          owner: tile.owner === -1 ? null : tile.owner,
          installedMule: tile.installedMule === "" ? null : (tile.installedMule as ResourceType),
        };
      }
    }
    return grid;
  }
}
