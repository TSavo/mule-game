import { describe, it, expect } from "vitest";
import { calculateSpoilage } from "../src/spoilage.js";
import type { ResourceInventory } from "../src/types.js";

describe("calculateSpoilage", () => {
  it("spoils 50% of raw food inventory", () => {
    const inv: ResourceInventory = { food: 10, energy: 0, smithore: 0, crystite: 0 };
    expect(calculateSpoilage(inv).food).toBe(5); // 10 * 0.5 spoiled → 5 remain
  });
  it("spoils 25% of raw energy inventory", () => {
    const inv: ResourceInventory = { food: 0, energy: 20, smithore: 0, crystite: 0 };
    expect(calculateSpoilage(inv).energy).toBe(15); // 20 * 0.25 spoiled → 15 remain
  });
  it("does not spoil smithore below threshold", () => {
    const inv: ResourceInventory = { food: 0, energy: 0, smithore: 30, crystite: 0 };
    expect(calculateSpoilage(inv).smithore).toBe(30);
  });
  it("spoils smithore above threshold of 50", () => {
    const inv: ResourceInventory = { food: 0, energy: 0, smithore: 60, crystite: 0 };
    expect(calculateSpoilage(inv).smithore).toBe(50);
  });
  it("spoils crystite above threshold of 50", () => {
    const inv: ResourceInventory = { food: 0, energy: 0, smithore: 0, crystite: 75 };
    expect(calculateSpoilage(inv).crystite).toBe(50);
  });
  it("does not spoil below zero", () => {
    const inv: ResourceInventory = { food: 1, energy: 1, smithore: 0, crystite: 0 };
    const result = calculateSpoilage(inv);
    // floor(1 * 0.5) = 0 food spoiled; floor(1 * 0.25) = 0 energy spoiled
    expect(result.food).toBe(1);
    expect(result.energy).toBe(1);
  });
  it("handles zero inventory", () => {
    const zero: ResourceInventory = { food: 0, energy: 0, smithore: 0, crystite: 0 };
    expect(calculateSpoilage(zero)).toEqual(zero);
  });
});
