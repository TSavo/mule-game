import { ResourceType, TerrainType, GameMode, type ResourceInventory } from "./types.js";

export const STARTING_MONEY: Record<GameMode, number> = {
  beginner: 1000,
  standard: 1000,
  tournament: 1000,
};

export const AI_TOURNAMENT_BONUS = 200;

export const STARTING_INVENTORY: ResourceInventory = {
  food: 4,
  energy: 2,
  smithore: 0,
  crystite: 0,
};

// Planet M.U.L.E. reference: shopStartFood=8, shopStartEnergy=8, shopStartSmithore=8
export const STORE_STARTING_INVENTORY: ResourceInventory = {
  food: 8,
  energy: 8,
  smithore: 8,
  crystite: 0,
};

export const STORE_STARTING_MULES = 14;

export const MULE_BASE_PRICE = 100;

export const OUTFIT_COST: Record<ResourceType, number> = {
  food: 25,
  energy: 50,
  smithore: 75,
  crystite: 100,
};

export const PRODUCTION_QUALITY: Record<string, Record<ResourceType, number>> = {
  // Planet M.U.L.E. ref: waterFood=4, waterEnergy=2, waterSmithore=0
  [TerrainType.River]: { food: 4, energy: 2, smithore: 0, crystite: 0 },
  [TerrainType.SmallWater]: { food: 2, energy: 1, smithore: 0, crystite: 0 },
  // Planet M.U.L.E. ref: desertFood=0, desertEnergy=4, desertSmithore=1
  [TerrainType.Plains]: { food: 0, energy: 4, smithore: 1, crystite: 0 },
  [TerrainType.Mountain1]: { food: 1, energy: 1, smithore: 2, crystite: 0 },
  [TerrainType.Mountain2]: { food: 1, energy: 1, smithore: 3, crystite: 0 },
  [TerrainType.Mountain3]: { food: 1, energy: 1, smithore: 4, crystite: 0 },
  [TerrainType.Town]: { food: 0, energy: 0, smithore: 0, crystite: 0 },
};

export const QUALITY_TO_UNITS: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4,
};

export const SPOILAGE_RATE: Record<ResourceType, number> = {
  food: 0.5, energy: 0.25, smithore: 0, crystite: 0,
};

export const SPOILAGE_THRESHOLD = 50;

// Planet M.U.L.E. ref: initial prices, buy/sell spread derived from priceRange
export const STORE_INITIAL_PRICE: Record<ResourceType, number> = {
  food: 30,
  energy: 25,
  smithore: 50,
  crystite: 50,
};

export const STORE_PRICE_RANGE: Record<ResourceType, number> = {
  food: 35,
  energy: 35,
  smithore: 35,
  crystite: 140,
};

// Buy price = initialPrice - priceRange/2 (floor), Sell price = initialPrice + priceRange/2 (ceiling)
// These shift with supply/demand. Starting values:
export const STORE_BUY_PRICE: Record<ResourceType, number> = {
  food: 13, energy: 8, smithore: 33, crystite: 50,
};

export const STORE_SELL_PRICE: Record<ResourceType, number> = {
  food: 48, energy: 43, smithore: 68, crystite: 150,
};

// Planet M.U.L.E. ref: maxDevelopmentTime=47.5, minDevelopmentTime=5.0
export const MAX_TURN_DURATION_MS = 47_500;
export const MIN_TURN_DURATION_MS = 5_000;

export const FOOD_REQUIRED_BY_ROUND: number[] = [
  0, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
];

export const ENERGY_PER_MULE = 1;

export const ENERGY_COST_PER_MULE: Record<string, number> = {
  food: 1, energy: 0, smithore: 1, crystite: 1,
};

export const ADJACENCY_BONUS: Record<number, number> = {
  1: 0, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 4,
};

export const WAMPUS_BOUNTY_BY_ROUND: number[] = [
  0, 100, 100, 100, 200, 200, 200, 200, 300, 300, 300, 300, 400,
];

export const ROUNDS_BY_MODE: Record<GameMode, number> = {
  beginner: 6, standard: 12, tournament: 12,
};

// Planet M.U.L.E. ref: auctionCountdownTime=3.0, auctionTime=10.0
// NOTE: auction timer runs at 10% speed when players move, pauses during transactions
export const DECLARE_TIMER_MS = 3_000;
export const AUCTION_TIMER_MS = 10_000;
export const AUCTION_TIMER_SLOW_SPEED = 0.1; // timer speed when players are moving
export const AUCTION_SPEED_UP_DELAY_MS = 300; // delay before timer speeds up

// Transaction pacing — accelerates per unit traded
export const TRANSACTION_TIME_START_MS = 225;  // first unit delay
export const TRANSACTION_TIME_MS = 650;        // base time between units
export const TRANSACTION_TIME_DECREASE_MS = 75; // faster per unit
export const TRANSACTION_MIN_TIME_MS = 125;     // floor
export const TRANSACTION_GRACE_MS = 160;        // grace period after trade
export const TRANSACTION_GRACE_DECREASE_MS = 40; // grace shrinks
export const TRANSACTION_GRACE_MIN_MS = 80;      // grace floor

// Tick system constants (from Planet M.U.L.E. decompilation)
export const AUCTION_TICK_SCALE = 10;             // ticks per price level
export const AUCTION_PRICE_STEP_LOW = 1;          // $1 per level (food/energy/smithore)
export const AUCTION_PRICE_STEP_HIGH = 4;         // $4 per level (crystite)
export const AUCTION_MAX_OUT_OF_AUCTION = 40;     // max ticks outside auction area
export const AUCTION_CHOOSE_BUY_SELL_TIME_MS = 3_000; // 3s choose phase before countdown

export function getAuctionPriceStep(resource: ResourceType): number {
  return resource === ResourceType.Crystite ? AUCTION_PRICE_STEP_HIGH : AUCTION_PRICE_STEP_LOW;
}

export const AUCTION_RESOURCE_ORDER: ResourceType[] = [
  ResourceType.Smithore, ResourceType.Crystite, ResourceType.Food, ResourceType.Energy,
];

export const LAND_VALUE = 500;
export const PUB_MAX_PAYOUT = 250;

// Planet M.U.L.E. ref: pub payout = pubRoundBonus[round] + random(0..pubMaxRandomAmount) * (timeLeft/maxTime)
export const PUB_ROUND_BONUS: number[] = [
  0, 25, 25, 25, 50, 50, 50, 50, 75, 75, 75, 75, 100,
];
export const PUB_MAX_RANDOM_AMOUNT = 100;

// Player event probability (Planet M.U.L.E. ref: 27.5%, not 25%)
export const PLAYER_EVENT_PROBABILITY = 0.275;

// Wampus visibility window (seconds)
export const WAMPUS_VISIBILITY_SECONDS = 0.75;

// Land grant timing
export const LAND_GRANT_PLOT_DURATION_FRAMES = 18;
export const LAND_GRANT_COUNTDOWN_S = 4.0;
export const LAND_GRANT_OUTRO_S = 3.5;

// Land auction timing
export const LAND_AUCTION_TIME_S = 34.25;
export const LAND_AUCTION_STARTING_PRICE = 160;
export const LAND_AUCTION_PRICE_RANGE = 140;
export const LAND_AUCTION_NO_SALE_TIME_S = 5.0;

// Development timing
export const DEVELOPMENT_COUNTDOWN_S = 4.0;
export const DEVELOPMENT_OUTRO_S = 2.0;
export const OUTFIT_MULE_TIME_S = 2.75;
export const ASSAY_TIME_S = 2.5;

// Production display timing
export const PRODUCTION_PREVIOUS_UNITS_TIME_S = 2.5;
export const PRODUCTION_USAGE_TIME_S = 1.0;
export const PRODUCTION_CURRENT_UNITS_TIME_S = 2.5;
export const PRODUCTION_SPOILAGE_TIME_S = 1.0;
export const PRODUCTION_RESULT_TIME_S = 9.0;
export const PRODUCTION_COLLECTION_END_TIME_S = 5.0;

// Skip/no goods display
export const SKIP_AUCTION_TIME_S = 4.0;
export const NO_GOODS_FOR_SALE_TIME_S = 4.0;

// Java reference timing constants
export const BUY_TIME_DURATION_S = 20.0;           // max time for store buy animation
export const DEVELOPMENT_MESSAGE_LIFE_S = 5.0;     // development phase message display

// Scoring
export const STORE_MAX_RESOURCE = 16;
export const POINTS_PER_MULE = 35;
export const MIN_MOUNTAINS = 6;
export const MAX_MOUNTAINS = 8;
export const MIN_CLUSTERS = 1;
export const MAX_CLUSTERS = 2;
export const MIN_CLUSTER_SIZE = 3;
export const MAX_CLUSTER_SIZE = 5;

export const COLONY_THRESHOLDS = {
  first_founder: 80_000,
  pioneer: 60_000,
  settler: 40_000,
};
