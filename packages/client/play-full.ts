Symbol.metadata ??= Symbol.for("Symbol.metadata");
import { Client } from "@colyseus/sdk";

const client = new Client("http://127.0.0.1:2567");
const room = await client.create("game", { mode: "standard", name: "Player 1" });
console.log("Connected as", room.sessionId);

let lastPhase = "";
let roundsSeen = 0;
room.onStateChange((state) => {
  if (state.phase !== lastPhase) {
    lastPhase = state.phase;
    const players = [];
    state.players?.forEach(p => players.push(p.name + (p.isAI ? "(AI)" : "")));
    console.log(`\n>> PHASE: ${state.phase} | Round ${state.round} | Players: ${players.join(", ")}`);

    if (state.eventMessage) console.log(`   Event: ${state.eventMessage}`);

    if (state.phase === "development") {
      console.log(`   Turn timer: ${Math.ceil(state.turnTimeRemaining/1000)}s | Store: ${state.store?.muleCount} M.U.L.E.s at $${state.store?.mulePrice}`);
    }
    if (state.phase === "summary") {
      roundsSeen++;
      state.players?.forEach(p => console.log(`   ${p.name}: $${p.money} F:${p.food} E:${p.energy} S:${p.smithore} Plots:${p.plotCount}`));
      console.log(`   Colony: ${state.colonyScore} (${state.colonyRating}) | Winner: P${state.winnerIndex}`);
    }
    if (state.phase === "game_over") {
      console.log("   GAME OVER!");
      state.players?.forEach(p => console.log(`   ${p.name}: $${p.money} F:${p.food} E:${p.energy} S:${p.smithore}`));
      console.log(`   Colony: ${state.colonyScore} (${state.colonyRating}) | Winner: P${state.winnerIndex}`);
      room.leave();
      process.exit(0);
    }
  }
});

room.send("start_game", {});
console.log("Game started!");

// Claim a plot during land grant
setTimeout(() => {
  if (room.state.phase === "land_grant") {
    console.log(">> Claiming plot...");
    room.send("claim_plot", {});
  }
}, 2000);

// During development, buy M.U.L.E. and install it
let actedThisRound = new Set();
setInterval(() => {
  const s = room.state;
  if (s.phase === "development" && s.currentPlayerTurn === 0 && !actedThisRound.has(s.round)) {
    actedThisRound.add(s.round);
    console.log(">> Our development turn! Buying M.U.L.E...");
    room.send("buy_mule", {});
    setTimeout(() => {
      room.send("outfit_mule", { resource: "energy" });
      let myTile = null;
      s.tiles?.forEach(t => { if (t.owner === 0 && !t.installedMule && !myTile) myTile = t; });
      if (myTile) {
        console.log(`>> Installing energy M.U.L.E. on r${myTile.row}c${myTile.col}`);
        room.send("install_mule", { row: myTile.row, col: myTile.col });
      }
      setTimeout(() => {
        console.log(">> Ending turn at pub...");
        room.send("visit_pub", {});
      }, 300);
    }, 200);
  }

  // Claim during land grant each round
  if (s.phase === "land_grant" && !actedThisRound.has("claim" + s.round)) {
    actedThisRound.add("claim" + s.round);
    setTimeout(() => {
      console.log(`>> Round ${s.round}: Claiming plot...`);
      room.send("claim_plot", {});
    }, 1500);
  }
}, 500);

// Timeout after 3 minutes
setTimeout(() => {
  console.log("\n=== TIMEOUT — Final state ===");
  const s = room.state;
  console.log(`Phase: ${s.phase} Round: ${s.round}`);
  s.players?.forEach(p => console.log(`  ${p.name}: $${p.money} F:${p.food} E:${p.energy} S:${p.smithore}`));
  room.leave();
  process.exit(0);
}, 180000);
