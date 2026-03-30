import "@tsmetadata/polyfill";

import express from "express";
import http from "http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom.js";
import { LobbyRoom } from "./rooms/LobbyRoom.js";

const app = express();
app.use((_req, res, next) => {
  const origin = _req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,Accept");
  res.header("Access-Control-Allow-Credentials", "true");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("game", GameRoom);
gameServer.define("lobby", LobbyRoom);

const PORT = Number(process.env.PORT ?? 2567);
gameServer.listen(PORT, "0.0.0.0").then(() => {
  console.log(`M.U.L.E. server listening on 0.0.0.0:${PORT}`);
}).catch(() => {
  // Fallback: if gameServer.listen fails with custom server, listen directly
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`M.U.L.E. server listening on 0.0.0.0:${PORT}`);
  });
});

process.on("uncaughtException", (err) => console.error("[UNCAUGHT]", err));
process.on("unhandledRejection", (err) => console.error("[UNHANDLED]", err));
