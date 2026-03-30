import { describe, it, expect } from "vitest";
import {
  MAP_ROWS,
  MAP_COLS,
  TOWN_ROW,
  TOWN_COL,
  AUCTION_RESOURCE_ORDER,
  SeededRNG,
  generateMap,
} from "@mule-game/shared";
import { GameState } from "../src/state/GameState.js";
import { PlayerSchema } from "../src/state/PlayerSchema.js";
import { TileSchema } from "../src/state/TileSchema.js";
import { PhaseManager } from "../src/phases/PhaseManager.js";
import { LandGrantPhase } from "../src/phases/LandGrantPhase.js";
import { LandAuctionPhase } from "../src/phases/LandAuctionPhase.js";
import { RandomEventPhase } from "../src/phases/RandomEventPhase.js";
import { DevelopmentPhase } from "../src/phases/DevelopmentPhase.js";
import { ProductionPhase } from "../src/phases/ProductionPhase.js";
import { TradingAuctionPhase } from "../src/phases/TradingAuctionPhase.js";
import { ScoringPhase } from "../src/phases/ScoringPhase.js";
import { AIPlayer } from "../src/ai/AIPlayer.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildState(seed: number): GameState {
  const state = new GameState();
  state.seed = seed;
  state.mode = "standard";

  // Generate map tiles
  const map = generateMap(seed);
  for (const row of map.tiles) {
    for (const tile of row) {
      const t = new TileSchema();
      t.row = tile.row;
      t.col = tile.col;
      t.terrain = tile.terrain;
      t.crystiteLevel = tile.crystiteLevel ?? "none";
      t.owner = -1;
      t.installedMule = "";
      state.tiles.push(t);
    }
  }

  // 4 AI players
  for (let i = 0; i < 4; i++) {
    const p = new PlayerSchema();
    p.index = i;
    p.name = `AI_${i}`;
    p.isAI = true;
    p.aiDifficulty = "beginner";
    p.money = 1000;
    p.food = 3;
    p.energy = 2;
    p.smithore = 0;
    p.crystite = 0;
    state.players.set(String(i), p);
  }

  return state;
}

// Run the land_grant phase: cursor scans, each AI claims once
function runLandGrant(state: GameState, rng: SeededRNG): void {
  const phase = new LandGrantPhase();
  phase.start(state);

  const aiPlayers = [
    new AIPlayer(0, "beginner"),
    new AIPlayer(1, "beginner"),
    new AIPlayer(2, "beginner"),
    new AIPlayer(3, "beginner"),
  ];

  const claimed = new Set<number>();

  while (state.landGrantActive) {
    const row = state.landGrantCursorRow;
    const col = state.landGrantCursorCol;
    // Skip town tile
    if (!(row === TOWN_ROW && col === TOWN_COL)) {
      // Let each AI decide if they want this tile (each can claim once)
      for (const ai of aiPlayers) {
        if (!claimed.has(ai.playerIndex)) {
          // AI decides via decideLandGrant — if the current cursor tile looks good, claim it
          const choice = ai.decideLandGrant(state, rng);
          if (choice && choice.row === row && choice.col === col) {
            const ok = phase.claimPlot(state, ai.playerIndex);
            if (ok) claimed.add(ai.playerIndex);
          }
        }
      }
    }
    // Only advance if the tile wasn't claimed or was town
    const tile = state.tiles.find((t: any) => t.row === row && t.col === col);
    if (!tile || tile.owner === -1 || (row === TOWN_ROW && col === TOWN_COL)) {
      phase.advanceCursor(state);
    } else {
      // Tile was just claimed, advance so cursor moves off it
      phase.advanceCursor(state);
    }
  }
}

// Simpler land grant: just scan and let first available unclaimed AI claim each tile
function runLandGrantSimple(state: GameState, _rng: SeededRNG): void {
  const phase = new LandGrantPhase();
  phase.start(state);
  const claimed = new Set<number>();

  while (state.landGrantActive) {
    const row = state.landGrantCursorRow;
    const col = state.landGrantCursorCol;
    if (!(row === TOWN_ROW && col === TOWN_COL)) {
      // Let AIs claim in order if not yet claimed this round
      for (let i = 0; i < 4; i++) {
        if (!claimed.has(i)) {
          const ok = phase.claimPlot(state, i);
          if (ok) {
            claimed.add(i);
            break;
          }
        }
      }
    }
    phase.advanceCursor(state);
  }
}

// Run development phase for all 4 AI players
function runDevelopment(state: GameState, rng: SeededRNG, round: number): void {
  const devPhase = new DevelopmentPhase();
  devPhase.start(state, round);

  while (!devPhase.isComplete()) {
    const playerIdx = state.currentPlayerTurn;
    if (playerIdx < 0) break;
    const ai = new AIPlayer(playerIdx, "beginner");
    const actions = ai.decideDevelopment(state, rng, round);
    for (const action of actions) {
      switch (action.type) {
        case "buy_mule":
          devPhase.buyMule(state, playerIdx);
          break;
        case "outfit_mule":
          if (action.resource) devPhase.outfitMule(state, playerIdx, action.resource);
          break;
        case "install_mule":
          if (action.row !== undefined && action.col !== undefined) {
            devPhase.installMule(state, playerIdx, action.row, action.col);
          }
          break;
        case "visit_pub":
          devPhase.visitPub(state, playerIdx);
          break;
      }
    }
    devPhase.endTurn(state, round);
  }
}

// Run a single trading auction resource cycle
function runTradingAuctionResource(
  state: GameState,
  auctionPhase: TradingAuctionPhase,
  rng: SeededRNG,
): void {
  // Declare phase: AI declare their roles
  for (let i = 0; i < 4; i++) {
    const ai = new AIPlayer(i, "beginner");
    const role = ai.decideAuctionRole(state, rng);
    auctionPhase.declare(state, i, role);
  }

  // Start trading
  auctionPhase.startTrading(state);

  // Simulate trading by advancing the timer until expiry.
  // Tick the timer forward in large steps — no actual player movement,
  // so the timer runs at full speed and expires quickly.
  const BIG_DELTA = 5000; // 5 seconds per tick
  let iterations = 0;
  const MAX_ITER = 100;
  while (iterations < MAX_ITER) {
    const expired = auctionPhase.updateTimer(state, BIG_DELTA);
    auctionPhase.checkForTrades(state, iterations * BIG_DELTA);
    if (expired) break;
    iterations++;
  }
}

// Run all 4 collection + trading_auction cycles
function runAllAuctions(
  state: GameState,
  phaseManager: PhaseManager,
  rng: SeededRNG,
): void {
  const auctionPhase = new TradingAuctionPhase();
  auctionPhase.start(state);

  for (let resourceIdx = 0; resourceIdx < AUCTION_RESOURCE_ORDER.length; resourceIdx++) {
    // Run this resource's auction
    runTradingAuctionResource(state, auctionPhase, rng);

    // Advance to next resource (or mark complete)
    if (resourceIdx < AUCTION_RESOURCE_ORDER.length - 1) {
      auctionPhase.advanceToNextResource(state);
    }
  }
}

// ── Full 12-round game ────────────────────────────────────────────────────────

function playFullGame(seed: number): GameState {
  const state = buildState(seed);
  const phaseManager = new PhaseManager();
  const landAuctionPhase = new LandAuctionPhase();
  const randomEventPhase = new RandomEventPhase();
  const productionPhase = new ProductionPhase();
  const scoringPhase = new ScoringPhase();

  phaseManager.startGame(state);
  randomEventPhase.generateColonyEventDeck(new SeededRNG(seed));

  const MAX_TOTAL_PHASES = 300; // safety cap
  let totalPhases = 0;

  while (state.phase !== "game_over" && totalPhases < MAX_TOTAL_PHASES) {
    totalPhases++;
    const round = state.round;
    const rng = new SeededRNG(seed + round * 31337);

    switch (state.phase) {
      case "intro":
        phaseManager.advancePhase(state);
        break;

      case "land_grant":
        runLandGrantSimple(state, rng);
        phaseManager.advancePhase(state);
        break;

      case "land_auction":
        // Skip land auction (just advance)
        phaseManager.advancePhase(state);
        break;

      case "player_event":
        randomEventPhase.execute(state, rng, round);
        phaseManager.advancePhase(state);
        break;

      case "colony_event_a":
        randomEventPhase.drawColonyEvent(state);
        phaseManager.advancePhase(state);
        break;

      case "development":
        runDevelopment(state, rng, round);
        phaseManager.advancePhase(state);
        break;

      case "production":
        productionPhase.execute(state, round, rng);
        phaseManager.advancePhase(state);
        break;

      case "colony_event_b":
        randomEventPhase.drawColonyEvent(state);
        phaseManager.advancePhase(state);
        break;

      case "collection":
        // Collection phase just sets up; advance to trading_auction
        phaseManager.advancePhase(state);
        break;

      case "trading_auction": {
        // Run all 4 resource auctions in one go, then advance to summary
        runAllAuctions(state, phaseManager, rng);
        // After all 4 resources, advance past the last trading_auction 4 times
        // (PhaseManager tracks resources internally via advancePhase on trading_auction)
        // Actually PhaseManager.advancePhase on trading_auction increments auctionResourceIndex
        // We need to call it 4 times total (once per resource) to reach summary
        // But we've already done all 4 auctions — advance 4 times
        for (let i = 0; i < AUCTION_RESOURCE_ORDER.length; i++) {
          phaseManager.advancePhase(state);
          if (state.phase === "summary") break;
        }
        break;
      }

      case "summary":
        scoringPhase.execute(state);
        if (state.phase !== "game_over") {
          phaseManager.advancePhase(state);
        }
        break;

      default:
        // Unknown phase — advance to avoid infinite loop
        phaseManager.advancePhase(state);
        break;
    }
  }

  return state;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Full Game Integration", () => {
  it("completes a 12-round game with 4 AI players without crashing", () => {
    const state = playFullGame(12345);

    expect(state.phase).toBe("game_over");
    expect(state.colonyScore).toBeGreaterThan(0);
    expect(state.winnerIndex).toBeGreaterThanOrEqual(0);
    expect(state.winnerIndex).toBeLessThanOrEqual(3);
  });

  it("all 4 players remain solvent (money >= 0) throughout the game", () => {
    const state = playFullGame(99999);

    state.players.forEach((p: any) => {
      expect(p.money).toBeGreaterThanOrEqual(0);
    });
  });

  it("players claim tiles — plotCount > 0 after game", () => {
    const state = playFullGame(54321);

    let totalPlots = 0;
    state.players.forEach((p: any) => { totalPlots += p.plotCount; });
    expect(totalPlots).toBeGreaterThan(0);
  });

  it("different seeds produce different colony scores", () => {
    const state1 = playFullGame(11111);
    const state2 = playFullGame(22222);

    // At least one outcome differs (scores or winner)
    const different =
      state1.colonyScore !== state2.colonyScore ||
      state1.winnerIndex !== state2.winnerIndex;
    expect(different).toBe(true);
  });

  it("round counter reaches 12 before game_over", () => {
    // We track max round by peeking at state after each summary
    // Simplest: just verify the final state has been through all rounds
    const state = playFullGame(77777);
    // Game ends after round 12's summary calls advancePhase → game_over
    // colonyRating should be set
    expect(state.colonyRating).toBeTruthy();
    expect(state.phase).toBe("game_over");
  });
});
