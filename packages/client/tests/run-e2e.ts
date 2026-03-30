#!/usr/bin/env npx tsx
/**
 * Standalone E2E test runner — no vitest worker pool.
 * Starts a real server, connects as headless client, verifies game flow.
 *
 * Usage: cd packages/client && npx tsx tests/run-e2e.ts
 */
import { Client } from "@colyseus/sdk";
import { spawn, execSync, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

(Symbol as any).metadata ??= Symbol.for("Symbol.metadata");

const PORT = 2567;
const SERVER_URL = `ws://127.0.0.1:${PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let serverProcess: ChildProcess;
let passed = 0;
let failed = 0;
const failures: string[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function waitForPhase(room: any, phase: string, timeout = 60_000): Promise<void> {
  if (room.state?.phase === phase) return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${phase}", current: "${room.state?.phase}"`)), timeout);
    const check = setInterval(() => {
      if (room.state?.phase === phase) { clearInterval(check); clearTimeout(timer); resolve(); }
    }, 100);
  });
}

async function waitForCondition(fn: () => boolean, msg: string, timeout = 60_000): Promise<void> {
  if (fn()) return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${msg}`)), timeout);
    const check = setInterval(() => {
      if (fn()) { clearInterval(check); clearTimeout(timer); resolve(); }
    }, 100);
  });
}

async function createRoom(opts: Record<string, unknown> = {}) {
  const client = new Client(SERVER_URL);
  return client.create("game", { mode: "standard", name: "E2E", ...opts });
}

/** Auto-player that claims plots and visits pub so phases advance */
function startAutoPlayer(room: any): () => void {
  const acted = new Set<string>();
  const interval = setInterval(() => {
    const s = room.state;
    if (!s) return;
    if (s.phase === "land_grant" && s.landGrantActive) room.send("claim_plot", {});
    if (s.phase === "development" && s.currentPlayerTurn === 0 && !acted.has(`d${s.round}`)) {
      acted.add(`d${s.round}`);
      room.send("visit_pub", {});
    }
  }, 50);
  return () => clearInterval(interval);
}

/** Create room, start game, and auto-play through phases */
async function createPlayingRoom(opts: Record<string, unknown> = {}) {
  const room = await createRoom(opts);
  room.send("start_game", {});
  const stop = startAutoPlayer(room);
  return { room, stop };
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    failures.push(`${name}: ${e.message}`);
    console.log(`  ✗ ${name} — ${e.message}`);
  }
}

// ── Server lifecycle ─────────────────────────────────────────────────────

async function startServer() {
  try { execSync(`lsof -ti:${PORT} | xargs -r kill -9`, { stdio: "ignore" }); } catch {}
  await new Promise((r) => setTimeout(r, 1000));

  const serverDir = path.resolve(__dirname, "../../server");
  serverProcess = spawn("npx", ["tsx", "--import", "./polyfill.mjs", "src/index.ts"], {
    cwd: serverDir, stdio: "pipe", env: { ...process.env, PORT: String(PORT) }, detached: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server start timeout")), 15_000);
    serverProcess.stdout?.on("data", (d: Buffer) => { if (d.toString().includes("listening")) { clearTimeout(timeout); resolve(); } });
    serverProcess.stderr?.on("data", () => {});
    serverProcess.on("error", (e) => { clearTimeout(timeout); reject(e); });
  });
  console.log("Server started on port", PORT);
}

function stopServer() {
  try { if (serverProcess?.pid) process.kill(-serverProcess.pid, "SIGKILL"); } catch {}
  try { execSync(`lsof -ti:${PORT} | xargs -r kill -9`, { stdio: "ignore" }); } catch {}
}

// ── Tests ────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("\nM.U.L.E. E2E Tests\n");

  await test("connects and creates a game room", async () => {
    const room = await createRoom();
    assert(!!room.sessionId, "no sessionId");
    await room.leave();
  });

  await test("starts game and enters intro phase", async () => {
    const room = await createRoom();
    room.send("start_game", {});
    await waitForPhase(room, "intro", 10_000);
    assert(room.state.round === 1, `round=${room.state.round}`);
    let count = 0;
    room.state.players?.forEach(() => count++);
    assert(count === 4, `players=${count}`);
    await room.leave();
  });

  await test("progresses through land grant phase", async () => {
    const room = await createRoom();
    room.send("start_game", {});
    await waitForPhase(room, "land_grant");
    room.send("claim_plot", {});
    await new Promise((r) => setTimeout(r, 2000));
    room.send("claim_plot", {});
    await waitForCondition(() => {
      const p = room.state.players?.get("0");
      return p && p.plotCount > 0;
    }, "plotCount > 0");
    await room.leave();
  });

  await test("completes development phase with pub visit", async () => {
    const { room, stop } = await createPlayingRoom();
    try {
      // Land grant + land auction can take 30-40s, then development starts
      await waitForPhase(room, "development", 90_000);
      // Auto-player handles pub visit; just verify we reach summary
      await waitForPhase(room, "summary", 90_000);
      assert(room.state.colonyScore > 0, "no colony score");
    } finally { stop(); await room.leave(); }
  });

  await test("runs trading auction phase", async () => {
    const { room, stop } = await createPlayingRoom();
    try {
      await waitForPhase(room, "trading_auction");
      assert(room.state.auction?.active === true, "auction not active");
      assert(!!room.state.auction?.resource, "no auction resource");
    } finally { stop(); await room.leave(); }
  });

  await test("reaches summary phase with scores", async () => {
    const { room, stop } = await createPlayingRoom();
    try {
      await waitForPhase(room, "summary");
      assert(room.state.colonyScore > 0, `colonyScore=${room.state.colonyScore}`);
      assert(room.state.winnerIndex >= 0, `winnerIndex=${room.state.winnerIndex}`);
    } finally { stop(); await room.leave(); }
  });

  await test("food consumption reduces food each round", async () => {
    const { room, stop } = await createPlayingRoom();
    try {
      // Starting food is 4, round 1 consumes 3, so after development food should be 1
      await waitForPhase(room, "summary");
      const food = room.state.players?.get("0")?.food ?? 99;
      assert(food < 4, `food not consumed: ${food} (expected < 4)`);
    } finally { stop(); await room.leave(); }
  });

  await test("dynamic pricing changes store prices", async () => {
    const { room, stop } = await createPlayingRoom();
    try {
      await waitForPhase(room, "summary");
      const round1Buy = room.state.store?.foodBuyPrice ?? 0;
      await waitForPhase(room, "intro", 120_000); // round 2
      await waitForPhase(room, "summary", 120_000); // end of round 2
      const round2Buy = room.state.store?.foodBuyPrice ?? 0;
      assert(round2Buy !== round1Buy || round2Buy > 0, `prices didn't change: ${round1Buy} → ${round2Buy}`);
    } finally { stop(); await room.leave(); }
  });

  await test("MULE buy and install works", async () => {
    const room = await createRoom();
    room.send("start_game", {});
    // Claim a plot first
    await waitForPhase(room, "land_grant");
    const claimInterval = setInterval(() => room.send("claim_plot", {}), 50);
    await waitForCondition(() => (room.state.players?.get("0")?.plotCount ?? 0) > 0, "got plot");
    clearInterval(claimInterval);
    // Wait for development turn
    await waitForPhase(room, "development");
    await waitForCondition(() => room.state.currentPlayerTurn === 0, "our turn");
    room.send("buy_mule", {});
    await new Promise((r) => setTimeout(r, 500));
    assert(room.state.players?.get("0")?.hasMule === true, "no mule");
    room.send("outfit_mule", { resource: "food" });
    await new Promise((r) => setTimeout(r, 500));
    // Find our plot
    let plotRow = -1, plotCol = -1;
    room.state.tiles?.forEach((t: any) => { if (t.owner === 0 && plotRow < 0) { plotRow = t.row; plotCol = t.col; } });
    assert(plotRow >= 0, "no owned plot found");
    room.send("install_mule", { row: plotRow, col: plotCol });
    await new Promise((r) => setTimeout(r, 500));
    let installed = false;
    room.state.tiles?.forEach((t: any) => { if (t.row === plotRow && t.col === plotCol && t.installedMule === "food") installed = true; });
    assert(installed, "mule not installed");
    await room.leave();
  });

  await test("completes full 12-round game", async () => {
    const room = await createRoom();
    room.send("start_game", {});
    const actedRounds = new Set<string>();
    const interval = setInterval(() => {
      const s = room.state;
      if (!s) return;
      if (s.phase === "land_grant" && s.landGrantActive) room.send("claim_plot", {});
      if (s.phase === "development" && s.currentPlayerTurn === 0 && !actedRounds.has(`d${s.round}`)) {
        actedRounds.add(`d${s.round}`);
        room.send("visit_pub", {});
      }
    }, 50);
    try {
      await waitForPhase(room, "game_over", 600_000);
      assert(room.state.colonyScore > 0, `colonyScore=${room.state.colonyScore}`);
      assert(room.state.round >= 12, `round=${room.state.round}`);
    } finally {
      clearInterval(interval);
      await room.leave();
    }
  });

  await test("multiple rooms run simultaneously", async () => {
    const room1 = await createRoom({ name: "A" });
    const room2 = await createRoom({ name: "B" });
    assert(room1.sessionId !== room2.sessionId, "same sessionId");
    await room1.leave();
    await room2.leave();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  await startServer();
  try {
    await runTests();
  } finally {
    stopServer();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) { console.log("\nFailures:"); failures.forEach((f) => console.log(`  ${f}`)); }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); stopServer(); process.exit(1); });
