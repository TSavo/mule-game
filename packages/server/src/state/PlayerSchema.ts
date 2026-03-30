import { Schema, type } from "@colyseus/schema";

export class PlayerSchema extends Schema {
  @type("uint8") index: number = 0;
  @type("string") name: string = "";
  @type("string") species: string = "humanoid";
  @type("string") color: string = "red";
  @type("int32") money: number = 1000;
  @type("uint16") food: number = 0;
  @type("uint16") energy: number = 0;
  @type("uint16") smithore: number = 0;
  @type("uint16") crystite: number = 0;
  @type("boolean") isAI: boolean = false;
  @type("string") aiDifficulty: string = "";
  @type("uint8") plotCount: number = 0;
  @type("boolean") isReady: boolean = false;
  @type("boolean") hasMule: boolean = false;
  @type("string") muleOutfit: string = "";
  @type("boolean") turnComplete: boolean = false;
  @type("uint8") rank: number = 0;
  @type("int32") score: number = 0;
  // Pre-production snapshots (for collection display)
  @type("uint16") prevFood: number = 0;
  @type("uint16") prevEnergy: number = 0;
  @type("uint16") prevSmithore: number = 0;
  @type("uint16") prevCrystite: number = 0;
  // Spoilage amounts (for collection display)
  @type("int16") spoiledFood: number = 0;
  @type("int16") spoiledEnergy: number = 0;
  @type("string") auctionRole: string = "none";   // "buyer" | "seller" | "none"
  @type("int16") auctionTick: number = 0;          // current tick position
  @type("boolean") auctionInArena: boolean = false; // whether in the auction area
  @type("uint8") auctionPosition: number = 0;       // legacy/display compatibility
}
