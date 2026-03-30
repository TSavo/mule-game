import { describe, it, expect } from "vitest";
import { SeededRNG } from "../src/rng.js";

describe("SeededRNG", () => {
  it("produces deterministic sequence from same seed", () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it("produces different sequences from different seeds", () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(99);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).not.toEqual(seq2);
  });

  it("next() returns values between 0 and 1", () => {
    const rng = new SeededRNG(123);
    for (let i = 0; i < 100; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("nextInt(min, max) returns integers in range", () => {
    const rng = new SeededRNG(456);
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(3, 7);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(7);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("shuffle() produces deterministic shuffles", () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(rng1.shuffle(arr1)).toEqual(rng2.shuffle(arr2));
  });

  it("pick() selects a random element from array", () => {
    const rng = new SeededRNG(42);
    const items = ["a", "b", "c", "d"];
    const picked = rng.pick(items);
    expect(items).toContain(picked);
  });
});
