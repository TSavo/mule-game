import { Schema, type } from "@colyseus/schema";

export class AuctionSchema extends Schema {
  @type("string") resource: string = "";
  @type("boolean") active: boolean = false;
  @type("string") subPhase: string = "idle"; // idle | declare | trading | transaction | outro

  // Timer
  @type("uint16") timeRemaining: number = 0;
  @type("float32") timerSpeed: number = 1.0;   // 1.0 normal, 0.1 slow
  @type("boolean") timerPaused: boolean = false; // paused during transactions

  // Store prices
  @type("int16") storeBuyPrice: number = -1;
  @type("int16") storeSellPrice: number = -1;
  @type("uint16") storeUnits: number = 0;
  @type("boolean") storeClosed: boolean = false;

  // Tick state — highest buyer bid and lowest seller ask (in ticks)
  @type("int16") buyTick: number = -1;   // highest buyer tick in auction
  @type("int16") sellTick: number = -1;  // lowest seller tick in auction

  // Resource index (which resource in AUCTION_RESOURCE_ORDER)
  @type("uint8") currentResourceIndex: number = 0;

  // Transaction tracking
  @type("uint16") unitsTraded: number = 0;
  @type("int16") lastTradePrice: number = -1;
}
