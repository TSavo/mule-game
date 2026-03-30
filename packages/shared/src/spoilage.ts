import type { ResourceInventory } from "./types.js";
import { SPOILAGE_RATE, SPOILAGE_THRESHOLD } from "./constants.js";

export function calculateSpoilage(inventory: ResourceInventory): ResourceInventory {
  const foodSpoiled = Math.floor(inventory.food * SPOILAGE_RATE.food);
  const energySpoiled = Math.floor(inventory.energy * SPOILAGE_RATE.energy);
  return {
    food: inventory.food - foodSpoiled,
    energy: inventory.energy - energySpoiled,
    smithore: inventory.smithore > SPOILAGE_THRESHOLD ? SPOILAGE_THRESHOLD : inventory.smithore,
    crystite: inventory.crystite > SPOILAGE_THRESHOLD ? SPOILAGE_THRESHOLD : inventory.crystite,
  };
}
