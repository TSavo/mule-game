import type { RandomEvent, EventEffect, Player } from "./types.js";
import { RandomEventTarget, ResourceType } from "./types.js";
import type { SeededRNG } from "./rng.js";

export const RANDOM_EVENTS: RandomEvent[] = [
  // Good events targeting trailing player (10)
  {
    id: "relatives_package",
    description: "Your relatives sent you a package of food!",
    target: RandomEventTarget.Trailing,
    effect: { type: "resource", resource: ResourceType.Food, amount: 3 },
  },
  {
    id: "space_traveler",
    description: "A space traveler left smithore behind.",
    target: RandomEventTarget.Trailing,
    effect: { type: "resource", resource: ResourceType.Smithore, amount: 2 },
  },
  {
    id: "best_mule",
    description: "Your MULE won best of show — cash prize!",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 150 },
  },
  {
    id: "tap_dancing",
    description: "You won the colony tap dancing contest.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 120 },
  },
  {
    id: "wart_worm",
    description: "You sold a wart worm to the colony doctor.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 200 },
  },
  {
    id: "antique_computer",
    description: "You found an antique computer and sold it.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 180 },
  },
  {
    id: "swamp_eel",
    description: "You captured a rare swamp eel for the zoo.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 150 },
  },
  {
    id: "charity",
    description: "The colony charity fund selected you as recipient.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 250 },
  },
  {
    id: "investments",
    description: "Your investments paid off handsomely.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 180 },
  },
  {
    id: "dead_moose_rat",
    description: "You sold a dead moose rat to the medical lab.",
    target: RandomEventTarget.Trailing,
    effect: { type: "money", amount: 100 },
  },

  // Bad events targeting leader (5)
  {
    id: "pest_attack",
    description: "Pests attacked your food stores!",
    target: RandomEventTarget.Leader,
    effect: { type: "resource", resource: ResourceType.Food, amount: -3 },
  },
  {
    id: "radiation",
    description: "Radiation leak damaged your energy supply.",
    target: RandomEventTarget.Leader,
    effect: { type: "resource", resource: ResourceType.Energy, amount: -3 },
  },
  {
    id: "fire_in_store",
    description: "Fire broke out and destroyed smithore.",
    target: RandomEventTarget.Leader,
    effect: { type: "resource", resource: ResourceType.Smithore, amount: -2 },
  },
  {
    id: "hospital_bill",
    description: "A hospital bill arrives for unexpected surgery.",
    target: RandomEventTarget.Leader,
    effect: { type: "money", amount: -200 },
  },
  {
    id: "cat_burglar",
    description: "A cat burglar cleaned out your safe.",
    target: RandomEventTarget.Leader,
    effect: { type: "money", amount: -150 },
  },

  // Colony events (4)
  {
    id: "planetquake",
    description: "A planetquake disrupts all mining colony-wide.",
    target: RandomEventTarget.Colony,
    effect: { type: "production_modifier", resource: ResourceType.Smithore, multiplier: 0.5 },
  },
  {
    id: "pirate_raid",
    description: "Pirates raided the colony and stole all crystite!",
    target: RandomEventTarget.Colony,
    effect: { type: "pirate_raid" },
  },
  {
    id: "acid_rain",
    description: "Acid rain boosts food production colony-wide.",
    target: RandomEventTarget.Colony,
    effect: { type: "production_modifier", resource: ResourceType.Food, multiplier: 2.0 },
  },
  {
    id: "sunspot",
    description: "Sunspot activity doubles energy production colony-wide.",
    target: RandomEventTarget.Colony,
    effect: { type: "production_modifier", resource: ResourceType.Energy, multiplier: 2.0 },
  },
];

export function selectRandomEvent(rng: SeededRNG, _round: number): RandomEvent {
  return rng.pick(RANDOM_EVENTS);
}

export function applyEventEffect(player: Player, effect: EventEffect, round: number = 1): Player {
  // Event amounts scale with round: 1.0x at round 1, ~1.92x at round 12
  const multiplier = 1 + (round - 1) / 12;

  switch (effect.type) {
    case "money":
      return { ...player, money: Math.max(0, player.money + Math.floor(effect.amount * multiplier)) };

    case "resource": {
      const inv = { ...player.inventory };
      const key = effect.resource as keyof typeof inv;
      inv[key] = Math.max(0, inv[key] + Math.floor(effect.amount * multiplier));
      return { ...player, inventory: inv };
    }

    case "pirate_raid":
      return { ...player, inventory: { ...player.inventory, crystite: 0 } };

    case "lose_plot":
    case "gain_plot":
    case "production_modifier":
      // Handled at game state level
      return player;
  }
}
