import { describe, it, expect } from "vitest";
import { RANDOM_EVENTS, selectRandomEvent, applyEventEffect } from "../src/events.js";
import { RandomEventTarget, ResourceType } from "../src/types.js";
import type { Player } from "../src/types.js";
import { SeededRNG } from "../src/rng.js";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    index: 0, name: "Test", species: "humanoid" as any, color: "red",
    money: 1000, inventory: { food: 5, energy: 5, smithore: 5, crystite: 5 },
    ownedPlots: [], isAI: false, aiDifficulty: null, ...overrides,
  };
}

describe("RANDOM_EVENTS", () => {
  it("has at least 10 events defined", () => {
    expect(RANDOM_EVENTS.length).toBeGreaterThanOrEqual(10);
  });
  it("every event has id, description, target, and effect", () => {
    for (const event of RANDOM_EVENTS) {
      expect(event.id).toBeTruthy();
      expect(event.description).toBeTruthy();
      expect(event.target).toBeTruthy();
      expect(event.effect).toBeTruthy();
    }
  });
});

describe("selectRandomEvent", () => {
  it("returns deterministic event for same seed", () => {
    const e1 = selectRandomEvent(new SeededRNG(42), 1);
    const e2 = selectRandomEvent(new SeededRNG(42), 1);
    expect(e1.id).toBe(e2.id);
  });
  it("returns different events for different seeds", () => {
    const events = new Set<string>();
    for (let seed = 0; seed < 20; seed++) events.add(selectRandomEvent(new SeededRNG(seed), 1).id);
    expect(events.size).toBeGreaterThan(1);
  });
});

describe("applyEventEffect", () => {
  it("applies money gain", () => {
    expect(applyEventEffect(makePlayer({ money: 500 }), { type: "money", amount: 200 }).money).toBe(700);
  });
  it("applies money loss without going below 0", () => {
    expect(applyEventEffect(makePlayer({ money: 100 }), { type: "money", amount: -200 }).money).toBe(0);
  });
  it("applies resource gain", () => {
    expect(applyEventEffect(makePlayer(), { type: "resource", resource: ResourceType.Food, amount: 3 }).inventory.food).toBe(8);
  });
  it("applies resource loss without going below 0", () => {
    const p = makePlayer({ inventory: { food: 2, energy: 5, smithore: 5, crystite: 5 } });
    expect(applyEventEffect(p, { type: "resource", resource: ResourceType.Food, amount: -5 }).inventory.food).toBe(0);
  });
  it("pirate raid zeroes all crystite", () => {
    const p = makePlayer({ inventory: { food: 5, energy: 5, smithore: 5, crystite: 20 } });
    expect(applyEventEffect(p, { type: "pirate_raid" }).inventory.crystite).toBe(0);
  });
});
