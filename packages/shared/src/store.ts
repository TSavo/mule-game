import type { StoreState, ResourceInventory } from "./types.js";
import { ResourceType } from "./types.js";
import { STORE_STARTING_INVENTORY, STORE_STARTING_MULES, MULE_BASE_PRICE, STORE_BUY_PRICE, STORE_SELL_PRICE, STORE_INITIAL_PRICE, STORE_PRICE_RANGE } from "./constants.js";

export function createInitialStore(): StoreState {
  return {
    inventory: { ...STORE_STARTING_INVENTORY },
    muleCount: STORE_STARTING_MULES,
    mulePrice: MULE_BASE_PRICE,
    buyPrices: { ...STORE_BUY_PRICE } as ResourceInventory,
    sellPrices: { ...STORE_SELL_PRICE } as ResourceInventory,
  };
}

export function calculateMulePrice(muleCount: number, storeSmithore: number): number {
  return MULE_BASE_PRICE;
}

export function calculateMuleAvailability(currentMules: number, storeSmithore: number): { newMuleCount: number; smithoreConsumed: number } {
  const canManufacture = Math.min(storeSmithore, 2, Math.max(0, STORE_STARTING_MULES - currentMules));
  return { newMuleCount: currentMules + canManufacture, smithoreConsumed: canManufacture };
}

/**
 * Calculate dynamic store prices based on supply/demand (Planet M.U.L.E. reference).
 *
 * Supply ratio (0 = store has nothing, 1 = store has everything) drives the spread:
 * - buyPrice  (store pays player): rises when store needs the resource (low supply ratio)
 * - sellPrice (player pays store): rises when store stock is scarce (low supply ratio)
 *
 * The spread between buy and sell narrows when supply is moderate.
 */
export function calculateDynamicPrices(
  resource: ResourceType,
  storeStock: number,
  totalPlayerStock: number,
): { buyPrice: number; sellPrice: number } {
  const initial = STORE_INITIAL_PRICE[resource];
  const range = STORE_PRICE_RANGE[resource];
  const totalSupply = storeStock + totalPlayerStock;

  if (totalSupply === 0) {
    // Max scarcity — no supply anywhere
    return { buyPrice: initial, sellPrice: initial + Math.floor(range / 2) };
  }

  // Supply ratio: 0 = store has nothing, 1 = store has everything
  const supplyRatio = storeStock / totalSupply;

  // Buy price (store pays player): lower when store has lots, higher when store needs it
  const buyPrice = Math.max(1, Math.round(initial - range / 2 + range * (1 - supplyRatio) * 0.5));

  // Sell price (player pays store): higher when store has little, lower when abundant
  const sellPrice = Math.max(buyPrice + 1, Math.round(initial + range / 2 - range * supplyRatio * 0.5));

  return { buyPrice, sellPrice };
}

export function getStoreBuyPrice(resource: ResourceType, storeStock: number, totalPlayerStock: number = 0): number {
  return calculateDynamicPrices(resource, storeStock, totalPlayerStock).buyPrice;
}

export function getStoreSellPrice(resource: ResourceType, storeStock: number, totalPlayerStock: number = 0): number | null {
  if (storeStock <= 0) return null;
  return calculateDynamicPrices(resource, storeStock, totalPlayerStock).sellPrice;
}
