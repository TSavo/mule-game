Symbol.metadata ??= Symbol.for("Symbol.metadata");
import { Client } from "@colyseus/sdk";

const client = new Client("http://127.0.0.1:2567");

try {
  const room = await client.create("game", { mode: "standard", name: "Player 1" });
  console.log("Connected:", room.sessionId);

  let phases = [];
  room.onStateChange((state) => {
    const label = state.phase + " r" + state.round;
    if (phases.length === 0 || phases[phases.length - 1] !== label) {
      phases.push(label);
      console.log("PHASE:", label);
    }
  });

  room.send("start_game", {});
  console.log("Sent start_game");

  // Claim a plot after 3s
  setTimeout(() => {
    console.log("Claiming plot...");
    room.send("claim_plot", {});
  }, 3000);

  // Report every 5s
  const reporter = setInterval(() => {
    const s = room.state;
    console.log(`[${s.phase} r${s.round}] cursor:${s.landGrantCursorRow},${s.landGrantCursorCol} turn:${s.currentPlayerTurn} tiles:${s.tiles?.length} players:${s.players?.size}`);
  }, 5000);

  // Stop after 45s
  setTimeout(() => {
    clearInterval(reporter);
    console.log("\n=== FINAL ===");
    console.log("Phases seen:", phases.join(" → "));
    console.log("State:", room.state.phase, "round:", room.state.round);
    let owned = [];
    room.state.tiles?.forEach(t => { if (t.owner >= 0) owned.push(`r${t.row}c${t.col}→p${t.owner}`); });
    console.log("Owned tiles:", owned.join(", "));
    room.leave();
    process.exit(0);
  }, 45000);

} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
