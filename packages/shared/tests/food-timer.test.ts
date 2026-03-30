import { describe, it, expect } from "vitest";
import { calculateTurnDuration } from "../src/food-timer.js";

describe("calculateTurnDuration", () => {
  it("returns max duration when food meets requirement", () => {
    expect(calculateTurnDuration(4, 1)).toBe(47_500); // maxDevelopmentTime=47.5s
  });
  it("returns max when food exactly meets requirement", () => {
    expect(calculateTurnDuration(3, 1)).toBe(47_500);
  });
  it("returns reduced duration when 1 food short", () => {
    const d = calculateTurnDuration(2, 1);
    expect(d).toBeLessThan(47_500);
    expect(d).toBeGreaterThan(5_000);
  });
  it("returns minimum duration when zero food", () => {
    expect(calculateTurnDuration(0, 1)).toBe(5_000); // minDevelopmentTime=5.0s
  });
  it("requires more food in later rounds", () => {
    expect(calculateTurnDuration(3, 10)).toBeLessThan(calculateTurnDuration(3, 1));
  });
  it("clamps round to valid range", () => {
    const d = calculateTurnDuration(5, 15);
    expect(d).toBeGreaterThanOrEqual(5_000);
    expect(d).toBeLessThanOrEqual(47_500);
  });
});
