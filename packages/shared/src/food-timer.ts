import { FOOD_REQUIRED_BY_ROUND, MAX_TURN_DURATION_MS, MIN_TURN_DURATION_MS } from "./constants.js";

export function calculateTurnDuration(foodAmount: number, round: number, species?: string): number {
  // Mechtron always gets maximum turn duration regardless of food
  if (species === "mechtron") return MAX_TURN_DURATION_MS;
  const clampedRound = Math.min(Math.max(round, 1), FOOD_REQUIRED_BY_ROUND.length - 1);
  const required = FOOD_REQUIRED_BY_ROUND[clampedRound];
  if (foodAmount >= required) return MAX_TURN_DURATION_MS;
  if (foodAmount <= 0) return MIN_TURN_DURATION_MS;
  const ratio = foodAmount / required;
  const range = MAX_TURN_DURATION_MS - MIN_TURN_DURATION_MS;
  return Math.round(MIN_TURN_DURATION_MS + range * ratio);
}
