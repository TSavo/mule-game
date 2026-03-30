// ── Terrain ──

export enum TerrainType {
  Plains = "plains",
  River = "river",
  SmallWater = "small_water",
  Mountain1 = "mountain1",
  Mountain2 = "mountain2",
  Mountain3 = "mountain3",
  Town = "town",
}

export enum ResourceType {
  Food = "food",
  Energy = "energy",
  Smithore = "smithore",
  Crystite = "crystite",
}

export interface ResourceInventory {
  food: number;
  energy: number;
  smithore: number;
  crystite: number;
}

export const MAP_ROWS = 5;
export const MAP_COLS = 9;
export const TOWN_ROW = 2;
export const TOWN_COL = 4;
export const RIVER_COL = 4;
export const TOTAL_PLOTS = MAP_ROWS * MAP_COLS - 1;

export interface MapTile {
  row: number;
  col: number;
  terrain: TerrainType;
  crystiteLevel: CrystiteLevel;
  smithoreLevel: number;  // per-tile smithore richness (0-4)
  owner: number | null;
  installedMule: ResourceType | null;
}

export type CrystiteLevel = "none" | "low" | "medium" | "high";

export interface GameMap {
  tiles: MapTile[][];
  seed: number;
}

export enum Species {
  Mechtron = "mechtron",
  Gollumer = "gollumer",
  Packer = "packer",
  Bonzoid = "bonzoid",
  Spheroid = "spheroid",
  Flapper = "flapper",
  Leggite = "leggite",
  Humanoid = "humanoid",
}

export interface Player {
  index: number;
  name: string;
  species: Species;
  color: PlayerColor;
  money: number;
  inventory: ResourceInventory;
  ownedPlots: Array<{ row: number; col: number }>;
  isAI: boolean;
  aiDifficulty: AIDifficulty | null;
}

export type PlayerColor = "red" | "blue" | "green" | "purple";
export type AIDifficulty = "beginner" | "standard" | "tournament";

export interface StoreState {
  inventory: ResourceInventory;
  muleCount: number;
  mulePrice: number;
  buyPrices: ResourceInventory;
  sellPrices: ResourceInventory;
}

// Phase order from Planet M.U.L.E. decompilation:
// LAND_GRANT → LAND_AUCTION → PLAYER_EVENT → COLONY_EVENT_A →
// DEVELOPMENT → PRODUCTION → COLONY_EVENT_B →
// COLLECTION_SMITHORE → AUCTION_SMITHORE → COLLECTION_CRYSTITE → AUCTION_CRYSTITE →
// COLLECTION_FOOD → AUCTION_FOOD → COLLECTION_ENERGY → AUCTION_ENERGY → SUMMARY
export enum GamePhase {
  LandGrant = "land_grant",
  LandAuction = "land_auction",
  PlayerEvent = "player_event",
  ColonyEventA = "colony_event_a",
  Development = "development",
  Production = "production",
  ColonyEventB = "colony_event_b",
  Collection = "collection",       // pre-auction display per resource
  TradingAuction = "trading_auction",
  Summary = "summary",
  GameOver = "game_over",
}

export enum GameMode {
  Beginner = "beginner",
  Standard = "standard",
  Tournament = "tournament",
}

export interface GameConfig {
  mode: GameMode;
  totalRounds: number;
  humanPlayerCount: number;
  seed: number;
}

export enum RandomEventTarget {
  Leader = "leader",
  Trailing = "trailing",
  Colony = "colony",
}

export interface RandomEvent {
  id: string;
  description: string;
  target: RandomEventTarget;
  effect: EventEffect;
}

export type EventEffect =
  | { type: "money"; amount: number }
  | { type: "resource"; resource: ResourceType; amount: number }
  | { type: "lose_plot" }
  | { type: "gain_plot" }
  | { type: "production_modifier"; resource: ResourceType; multiplier: number }
  | { type: "pirate_raid" };

export enum AuctionRole {
  Buyer = "buyer",
  Seller = "seller",
  None = "none",
}

export interface AuctionState {
  resource: ResourceType;
  players: Array<{
    index: number;
    role: AuctionRole;
    pricePosition: number;
    unitsSold: number;
    unitsBought: number;
  }>;
  storeBuyPrice: number | null;
  storeSellPrice: number | null;
  storeUnits: number;
  timeRemaining: number;
}

export interface ProductionResult {
  tile: { row: number; col: number };
  resource: ResourceType;
  baseOutput: number;
  adjacencyBonus: number;
  energyModifier: number;
  finalOutput: number;
}

export interface PlayerScore {
  playerIndex: number;
  money: number;
  landValue: number;
  goodsValue: number;
  totalScore: number;
}

export interface ColonyScore {
  total: number;
  rating: "first_founder" | "pioneer" | "settler" | "failure";
}
