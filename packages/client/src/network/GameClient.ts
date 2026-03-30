import { Client, Room } from "@colyseus/sdk";
import { SERVER_URL } from "../config.js";

export class GameClient {
  private client: Client;
  private room: Room | null = null;

  constructor() { this.client = new Client(SERVER_URL); }

  async createGame(options: { mode?: string; name?: string; species?: string }): Promise<Room> {
    this.room = await this.client.create("game", options);
    return this.room;
  }

  async joinGame(roomId: string, options: { name?: string; species?: string }): Promise<Room> {
    this.room = await this.client.joinById(roomId, options);
    return this.room;
  }

  getRoom(): Room | null { return this.room; }

  startGame(): void { this.room?.send("start_game", {}); }
  claimPlot(): void { this.room?.send("claim_plot", {}); }
  bid(amount: number): void { this.room?.send("bid", { amount }); }
  buyMule(): void { this.room?.send("buy_mule", {}); }
  outfitMule(resource: string): void { this.room?.send("outfit_mule", { resource }); }
  installMule(row: number, col: number): void { this.room?.send("install_mule", { row, col }); }
  visitPub(): void { this.room?.send("visit_pub", {}); }
  endTurn(): void { this.room?.send("end_turn", {}); }
  declareAuction(role: "buyer" | "seller"): void { this.room?.send("declare_auction", { role }); }
  setAuctionTick(tick: number): void { this.room?.send("set_auction_tick", { tick }); }
  assay(): void { this.room?.send("assay", {}); }
  sellPlot(row: number, col: number): void { this.room?.send("sell_plot", { row, col }); }
  catchWampus(): void { this.room?.send("catch_wampus", {}); }
  disconnect(): void { this.room?.leave(); this.room = null; }
}
