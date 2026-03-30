import { Schema, type } from "@colyseus/schema";

export class StoreSchema extends Schema {
  @type("uint16") food: number = 8;
  @type("uint16") energy: number = 8;
  @type("uint16") smithore: number = 8;
  @type("uint16") crystite: number = 0;
  @type("uint8") muleCount: number = 14;
  @type("uint16") mulePrice: number = 100;
  @type("uint16") foodBuyPrice: number = 20;
  @type("uint16") foodSellPrice: number = 40;
  @type("uint16") energyBuyPrice: number = 30;
  @type("uint16") energySellPrice: number = 60;
  @type("uint16") smithoreBuyPrice: number = 50;
  @type("uint16") smithoreSellPrice: number = 100;
  @type("uint16") crystiteBuyPrice: number = 50;
  @type("uint16") crystiteSellPrice: number = 150;

  // Average traded price per resource — persists across rounds for price recalculation
  @type("int16") foodAvgPrice: number = -1;
  @type("int16") energyAvgPrice: number = -1;
  @type("int16") smithoreAvgPrice: number = -1;
  @type("int16") crystiteAvgPrice: number = -1;
}
