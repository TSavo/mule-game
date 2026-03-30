// Direct server-side play test — no network, no client SDK
import "@tsmetadata/polyfill";
import { GameState } from "./src/state/GameState.js";
import { PlayerSchema } from "./src/state/PlayerSchema.js";
import { TileSchema } from "./src/state/TileSchema.js";
import { PhaseManager } from "./src/phases/PhaseManager.js";
import { LandGrantPhase } from "./src/phases/LandGrantPhase.js";
import { DevelopmentPhase } from "./src/phases/DevelopmentPhase.js";
import { ProductionPhase } from "./src/phases/ProductionPhase.js";
import { RandomEventPhase } from "./src/phases/RandomEventPhase.js";
import { TradingAuctionPhase } from "./src/phases/TradingAuctionPhase.js";
import { ScoringPhase } from "./src/phases/ScoringPhase.js";
import { AIPlayer } from "./src/ai/AIPlayer.js";
import {
  generateMap, SeededRNG, STARTING_MONEY, STARTING_INVENTORY,
  MAP_ROWS, MAP_COLS, GameMode, AUCTION_RESOURCE_ORDER,
} from "@mule-game/shared";

const state = new GameState();
state.mode = "standard";
state.seed = 42;
const rng = new SeededRNG(42);
const map = generateMap(42);

// Build tiles
for (let r = 0; r < MAP_ROWS; r++) {
  for (let c = 0; c < MAP_COLS; c++) {
    const t = new TileSchema();
    t.row = r; t.col = c;
    t.terrain = map.tiles[r][c].terrain;
    t.crystiteLevel = map.tiles[r][c].crystiteLevel;
    state.tiles.push(t);
  }
}

// Add 4 players (1 human + 3 AI)
const COLORS = ["red", "blue", "green", "purple"];
const ais: AIPlayer[] = [];
for (let i = 0; i < 4; i++) {
  const p = new PlayerSchema();
  p.index = i; p.name = i === 0 ? "Player 1" : `AI ${i+1}`;
  p.color = COLORS[i]; p.species = "humanoid";
  p.money = 1000; p.food = 4; p.energy = 2;
  p.isAI = i > 0; p.aiDifficulty = i > 0 ? "standard" : "";
  state.players.set(String(i), p);
  if (i > 0) ais.push(new AIPlayer(i, "standard"));
}

const pm = new PhaseManager();
const landGrant = new LandGrantPhase();
const dev = new DevelopmentPhase();
const prod = new ProductionPhase();
const events = new RandomEventPhase();
const auction = new TradingAuctionPhase();
const scoring = new ScoringPhase();

pm.startGame(state);
console.log(`Started: phase=${state.phase} round=${state.round}`);

for (let round = 1; round <= 12; round++) {
  console.log(`\n=== ROUND ${round} ===`);

  // Land Grant
  console.log(`Phase: ${state.phase}`);
  landGrant.start(state);
  let claimed = false;
  while (state.landGrantActive) {
    // Human claims first good tile
    if (!claimed && state.landGrantCursorRow < MAP_ROWS) {
      const tile = state.tiles.find((t: any) => t.row === state.landGrantCursorRow && t.col === state.landGrantCursorCol);
      if (tile && tile.owner === -1 && tile.terrain !== "town") {
        landGrant.claimPlot(state, 0);
        claimed = true;
      }
    }
    // AI claims
    for (const ai of ais) {
      const decision = ai.decideLandGrant(state, rng);
      if (decision && decision.row === state.landGrantCursorRow && decision.col === state.landGrantCursorCol) {
        landGrant.claimPlot(state, ai.playerIndex);
      }
    }
    landGrant.advanceCursor(state);
  }
  console.log("  Land grant done");

  // Land Auction — skip
  pm.advancePhase(state); // → land_auction
  pm.advancePhase(state); // → player_event
  console.log(`  Phase: ${state.phase}`);
  events.execute(state, rng, round);

  pm.advancePhase(state); // → colony_event_a
  events.execute(state, rng, round);

  pm.advancePhase(state); // → development
  console.log(`  Phase: ${state.phase}`);
  dev.start(state, round);
  for (let i = 0; i < 4; i++) {
    const ai = ais.find(a => a.playerIndex === state.currentPlayerTurn);
    if (ai) {
      const actions = ai.decideDevelopment(state, rng, round);
      for (const action of actions) {
        switch (action.type) {
          case "buy_mule": dev.buyMule(state, ai.playerIndex); break;
          case "outfit_mule": dev.outfitMule(state, ai.playerIndex, action.resource!); break;
          case "install_mule": dev.installMule(state, ai.playerIndex, action.row!, action.col!); break;
          case "visit_pub": dev.visitPub(state, ai.playerIndex); break;
        }
      }
    } else {
      // Human: just visit pub
      dev.visitPub(state, 0);
    }
    dev.endTurn(state, round);
  }
  console.log("  Development done");

  pm.advancePhase(state); // → production
  console.log(`  Phase: ${state.phase}`);
  prod.execute(state, round);

  pm.advancePhase(state); // → colony_event_b
  events.execute(state, rng, round);

  // Collection + Auction x4
  for (let ri = 0; ri < 4; ri++) {
    pm.advancePhase(state); // → collection
    pm.advancePhase(state); // → trading_auction

    const resource = pm.getCurrentAuctionResource();
    // Run a simple AI auction: sellers sell to store, buyers buy from store
    const aPhase = new TradingAuctionPhase();
    aPhase.start(state);

    // AI declares
    for (const ai of ais) {
      const role = ai.decideAuctionRole(state, rng);
      aPhase.declare(state, ai.playerIndex, role);
    }
    // Human declares buyer for food/energy, seller for smithore
    if (resource === "food" || resource === "energy") {
      aPhase.declare(state, 0, "buyer");
    } else {
      aPhase.declare(state, 0, "seller");
    }

    aPhase.startTrading(state);

    // Simulate trades: each seller sells 1 unit to store, each buyer buys 1 from store
    state.players.forEach((p: any) => {
      if (p.auctionRole === "seller" && (p as any)[resource] > 0) {
        aPhase.sellToStore(state, p.index);
      } else if (p.auctionRole === "buyer") {
        aPhase.buyFromStore(state, p.index);
      }
    });
  }
  pm.advancePhase(state); // → summary
  console.log(`  Phase after auctions: ${state.phase}`);

  if (state.phase === "summary") {
    scoring.execute(state);
    console.log(`  Score: colony=${state.colonyScore} winner=P${state.winnerIndex}`);
    pm.advancePhase(state); // → next round
  } else {
    console.log(`  Unexpected phase: ${state.phase}`);
  }
}

// Final report
console.log("\n=== FINAL ===");
const owned: string[] = [];
state.tiles.forEach((t: any) => { if (t.owner >= 0) owned.push(`r${t.row}c${t.col}→P${t.owner}`); });
console.log("Owned:", owned.join(", "));
state.players.forEach((p: any) => {
  console.log(`  ${p.name}: $${p.money} F:${p.food} E:${p.energy} S:${p.smithore} C:${p.crystite}`);
});
