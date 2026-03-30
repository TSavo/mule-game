import { Schema, type } from "@colyseus/schema";

export class TileSchema extends Schema {
  @type("uint8") row: number = 0;
  @type("uint8") col: number = 0;
  @type("string") terrain: string = "plains";
  @type("string") crystiteLevel: string = "none";
  @type("uint8") smithoreLevel: number = 0;  // per-tile smithore richness (0-4)
  @type("boolean") crystiteRevealed: boolean = false;  // assay office reveals this
  @type("int8") owner: number = -1;
  @type("string") installedMule: string = "";
  @type("uint8") lastProduction: number = 0;   // units produced last round
  @type("boolean") hadEnergy: boolean = true;    // whether tile had energy last production
}
