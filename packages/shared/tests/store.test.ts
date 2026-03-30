import { describe, it, expect } from "vitest";
import { createInitialStore, calculateMulePrice, calculateMuleAvailability, getStoreBuyPrice, getStoreSellPrice, calculateDynamicPrices } from "../src/store.js";
import { ResourceType } from "../src/types.js";

describe("createInitialStore", () => {
  it("starts with 8 food, 8 energy, 8 smithore, 0 crystite", () => {
    const store = createInitialStore();
    expect(store.inventory.food).toBe(8);
    expect(store.inventory.energy).toBe(8);
    expect(store.inventory.smithore).toBe(8);
    expect(store.inventory.crystite).toBe(0);
  });
  it("starts with 14 M.U.L.E.s", () => {
    expect(createInitialStore().muleCount).toBe(14);
  });
});

describe("calculateMulePrice", () => {
  it("returns base price when store has plenty", () => {
    expect(calculateMulePrice(14, 10)).toBe(100);
  });
  it("increases price as M.U.L.E. count drops", () => {
    expect(calculateMulePrice(3, 0)).toBeGreaterThanOrEqual(calculateMulePrice(14, 10));
  });
  it("returns high price when none available", () => {
    expect(calculateMulePrice(0, 0)).toBeGreaterThanOrEqual(100);
  });
});

describe("calculateMuleAvailability", () => {
  it("manufactures M.U.L.E.s from smithore", () => {
    const result = calculateMuleAvailability(5, 4);
    expect(result.newMuleCount).toBeGreaterThan(5);
    expect(result.smithoreConsumed).toBeGreaterThan(0);
  });
  it("does not manufacture if no smithore", () => {
    const result = calculateMuleAvailability(5, 0);
    expect(result.newMuleCount).toBe(5);
    expect(result.smithoreConsumed).toBe(0);
  });
});

describe("calculateDynamicPrices", () => {
  it("returns higher sell price when store has little stock", () => {
    const scarce = calculateDynamicPrices(ResourceType.Food, 2, 16);
    const abundant = calculateDynamicPrices(ResourceType.Food, 16, 2);
    expect(scarce.sellPrice).toBeGreaterThan(abundant.sellPrice);
  });

  it("returns higher buy price when store needs the resource", () => {
    const scarce = calculateDynamicPrices(ResourceType.Food, 2, 16);
    const abundant = calculateDynamicPrices(ResourceType.Food, 16, 2);
    expect(scarce.buyPrice).toBeGreaterThan(abundant.buyPrice);
  });

  it("buy price is always less than sell price", () => {
    for (const resource of [ResourceType.Food, ResourceType.Energy, ResourceType.Smithore, ResourceType.Crystite]) {
      for (const [store, player] of [[0, 10], [5, 5], [10, 0], [1, 100], [100, 1]]) {
        if (store === 0) continue; // sell price not relevant when store has 0
        const { buyPrice, sellPrice } = calculateDynamicPrices(resource, store, player);
        expect(sellPrice).toBeGreaterThan(buyPrice);
      }
    }
  });

  it("handles zero total supply (max scarcity)", () => {
    const { buyPrice, sellPrice } = calculateDynamicPrices(ResourceType.Food, 0, 0);
    expect(buyPrice).toBeGreaterThan(0);
    expect(sellPrice).toBeGreaterThan(buyPrice);
  });

  it("buy price is always at least 1", () => {
    const { buyPrice } = calculateDynamicPrices(ResourceType.Food, 100, 0);
    expect(buyPrice).toBeGreaterThanOrEqual(1);
  });
});

describe("getStoreBuyPrice", () => {
  it("returns a price for food", () => {
    expect(getStoreBuyPrice(ResourceType.Food, 16, 8)).toBeGreaterThan(0);
  });
  it("always buys (unlimited money)", () => {
    expect(getStoreBuyPrice(ResourceType.Smithore, 0, 10)).toBeGreaterThan(0);
  });
  it("works with default totalPlayerStock", () => {
    expect(getStoreBuyPrice(ResourceType.Food, 16)).toBeGreaterThan(0);
  });
});

describe("getStoreSellPrice", () => {
  it("returns price when store has stock", () => {
    expect(getStoreSellPrice(ResourceType.Food, 16, 8)).toBeGreaterThan(0);
  });
  it("returns null when store has no stock", () => {
    expect(getStoreSellPrice(ResourceType.Smithore, 0, 10)).toBeNull();
  });
  it("sell price higher than buy price", () => {
    expect(getStoreSellPrice(ResourceType.Food, 16, 8)!).toBeGreaterThan(getStoreBuyPrice(ResourceType.Food, 16, 8));
  });
  it("works with default totalPlayerStock", () => {
    expect(getStoreSellPrice(ResourceType.Food, 16)!).toBeGreaterThan(getStoreBuyPrice(ResourceType.Food, 16));
  });
});
