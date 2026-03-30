import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";
import { TileSchema } from "./TileSchema.js";
import { StoreSchema } from "./StoreSchema.js";
import { AuctionSchema } from "./AuctionSchema.js";

export class GameState extends Schema {
  @type("uint8") round: number = 0;
  @type("string") phase: string = "land_grant";
  @type("string") mode: string = "standard";
  @type("uint32") seed: number = 0;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([TileSchema]) tiles = new ArraySchema<TileSchema>();
  @type(StoreSchema) store = new StoreSchema();
  @type(AuctionSchema) auction = new AuctionSchema();
  @type("uint8") landGrantCursorRow: number = 0;
  @type("uint8") landGrantCursorCol: number = 0;
  @type("boolean") landGrantActive: boolean = false;
  @type("int8") currentPlayerTurn: number = -1;
  @type("uint16") turnTimeRemaining: number = 0;
  @type("string") eventMessage: string = "";
  @type("uint32") colonyScore: number = 0;
  @type("string") colonyRating: string = "";
  @type("int8") winnerIndex: number = -1;
  @type("boolean") wampusVisible: boolean = false;
  @type("uint8") wampusRow: number = 0;
  @type("uint8") wampusCol: number = 0;
}
