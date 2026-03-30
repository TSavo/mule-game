import { describe, it, expect } from "vitest";
import { calculatePlayerScore, calculateColonyScore, determineWinner } from "../src/scoring.js";
import type { Player } from "../src/types.js";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    index: 0, name: "Test", species: "humanoid" as any, color: "red",
    money: 1000, inventory: { food: 5, energy: 5, smithore: 5, crystite: 5 },
    ownedPlots: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    isAI: false, aiDifficulty: null, ...overrides,
  };
}
const storePrices = { food: 30, energy: 45, smithore: 75, crystite: 100 };

describe("calculatePlayerScore", () => {
  it("sums money + land value + goods value", () => {
    const score = calculatePlayerScore(makePlayer({ money: 500 }), storePrices);
    expect(score.money).toBe(500);
    expect(score.landValue).toBe(1000); // 2 plots * $500
    expect(score.goodsValue).toBe(5*30 + 5*45 + 5*75 + 5*100);
    expect(score.totalScore).toBe(500 + 1000 + score.goodsValue);
  });
  it("handles player with no plots", () => {
    expect(calculatePlayerScore(makePlayer({ ownedPlots: [] }), storePrices).landValue).toBe(0);
  });
  it("handles player with no inventory", () => {
    expect(calculatePlayerScore(makePlayer({ inventory: { food: 0, energy: 0, smithore: 0, crystite: 0 } }), storePrices).goodsValue).toBe(0);
  });
});

describe("calculateColonyScore", () => {
  it("sums all player scores", () => {
    const players = [makePlayer({ index: 0, money: 10000 }), makePlayer({ index: 1, money: 10000 }), makePlayer({ index: 2, money: 10000 }), makePlayer({ index: 3, money: 10000 })];
    expect(calculateColonyScore(players, storePrices).total).toBeGreaterThan(0);
  });
  it("rates high colony as first_founder", () => {
    const players = Array.from({ length: 4 }, (_, i) => makePlayer({ index: i, money: 50000, ownedPlots: Array(10).fill({ row: 0, col: 0 }) }));
    expect(calculateColonyScore(players, storePrices).rating).toBe("first_founder");
  });
  it("rates low colony as failure", () => {
    const players = Array.from({ length: 4 }, (_, i) => makePlayer({ index: i, money: 100, ownedPlots: [], inventory: { food: 0, energy: 0, smithore: 0, crystite: 0 } }));
    expect(calculateColonyScore(players, storePrices).rating).toBe("failure");
  });
});

describe("determineWinner", () => {
  it("returns player with highest total score", () => {
    const players = [makePlayer({ index: 0, money: 500 }), makePlayer({ index: 1, money: 2000 }), makePlayer({ index: 2, money: 100 }), makePlayer({ index: 3, money: 800 })];
    expect(determineWinner(players, storePrices).playerIndex).toBe(1);
  });
  it("breaks ties by higher player index (trailing player wins)", () => {
    const players = [makePlayer({ index: 0, money: 1000 }), makePlayer({ index: 1, money: 1000 })];
    expect(determineWinner(players, storePrices).playerIndex).toBe(1);
  });
});
