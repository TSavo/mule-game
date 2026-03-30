import { Room, Client } from "@colyseus/core";
import { Schema, type, MapSchema } from "@colyseus/schema";

class LobbyGameInfo extends Schema {
  @type("string") roomId: string = "";
  @type("string") mode: string = "standard";
  @type("uint8") playerCount: number = 0;
  @type("uint8") maxPlayers: number = 4;
  @type("boolean") started: boolean = false;
}

class LobbyState extends Schema {
  @type({ map: LobbyGameInfo }) games = new MapSchema<LobbyGameInfo>();
}

export class LobbyRoom extends Room<LobbyState> {
  onCreate() { this.setState(new LobbyState()); }

  onJoin(_client: Client) {}

  onLeave(_client: Client, _consented?: boolean) {}
}
