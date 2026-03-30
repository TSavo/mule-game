import { describe, it, expect } from "vitest";
import { PhaseManager } from "../src/phases/PhaseManager.js";
import { GameState } from "../src/state/GameState.js";

describe("PhaseManager", () => {
  it("starts at intro phase, round 1", () => {
    const state = new GameState();
    const pm = new PhaseManager();
    pm.startGame(state);
    expect(state.round).toBe(1);
    expect(state.phase).toBe("intro");
  });

  it("advances through pre-development phases in order", () => {
    const state = new GameState();
    const pm = new PhaseManager();
    pm.startGame(state);
    expect(state.phase).toBe("intro");

    pm.advancePhase(state);
    expect(state.phase).toBe("land_grant");

    pm.advancePhase(state);
    expect(state.phase).toBe("land_auction");

    pm.advancePhase(state);
    expect(state.phase).toBe("player_event");

    pm.advancePhase(state);
    expect(state.phase).toBe("colony_event_a");

    pm.advancePhase(state);
    expect(state.phase).toBe("development");
  });

  it("advances through production and post-production phases", () => {
    const state = new GameState();
    const pm = new PhaseManager();
    pm.startGame(state);

    // Skip to development (intro + 4 more)
    for (let i = 0; i < 5; i++) pm.advancePhase(state);
    expect(state.phase).toBe("development");

    pm.advancePhase(state);
    expect(state.phase).toBe("production");

    pm.advancePhase(state);
    expect(state.phase).toBe("colony_event_b");

    pm.advancePhase(state);
    expect(state.phase).toBe("collection");
    expect(pm.getCurrentAuctionResource()).toBe("smithore");
  });

  it("cycles through collection+auction for all 4 resources", () => {
    const state = new GameState();
    const pm = new PhaseManager();
    pm.startGame(state);

    // Skip to colony_event_b (intro + 6 more)
    for (let i = 0; i < 7; i++) pm.advancePhase(state);
    expect(state.phase).toBe("colony_event_b");

    // Resource 1: smithore
    pm.advancePhase(state);
    expect(state.phase).toBe("collection");
    expect(pm.getCurrentAuctionResource()).toBe("smithore");
    pm.advancePhase(state);
    expect(state.phase).toBe("trading_auction");

    // Resource 2: crystite
    pm.advancePhase(state);
    expect(state.phase).toBe("collection");
    expect(pm.getCurrentAuctionResource()).toBe("crystite");
    pm.advancePhase(state);
    expect(state.phase).toBe("trading_auction");

    // Resource 3: food
    pm.advancePhase(state);
    expect(state.phase).toBe("collection");
    expect(pm.getCurrentAuctionResource()).toBe("food");
    pm.advancePhase(state);
    expect(state.phase).toBe("trading_auction");

    // Resource 4: energy
    pm.advancePhase(state);
    expect(state.phase).toBe("collection");
    expect(pm.getCurrentAuctionResource()).toBe("energy");
    pm.advancePhase(state);
    expect(state.phase).toBe("trading_auction");

    // After 4th auction → summary
    pm.advancePhase(state);
    expect(state.phase).toBe("summary");
  });

  it("increments round after summary phase", () => {
    const state = new GameState();
    state.mode = "standard";
    const pm = new PhaseManager();
    pm.startGame(state);

    // Full round: intro + 7 linear phases + 8 for 4x(collection+auction) = 16 advances to summary
    // intro(0) → land_grant(1) → land_auction(2) → player_event(3) → colony_event_a(4) →
    // development(5) → production(6) → colony_event_b(7) →
    // collection(8) → auction(9) → collection(10) → auction(11) →
    // collection(12) → auction(13) → collection(14) → auction(15) → summary(16)
    for (let i = 0; i < 16; i++) pm.advancePhase(state);
    expect(state.phase).toBe("summary");
    expect(state.round).toBe(1);

    pm.advancePhase(state);
    expect(state.round).toBe(2);
    expect(state.phase).toBe("intro");
  });

  it("transitions to game_over after final round summary", () => {
    const state = new GameState();
    state.mode = "standard";
    const pm = new PhaseManager();
    pm.startGame(state);
    state.round = 12;
    state.phase = "summary";

    pm.advancePhase(state);
    expect(state.phase).toBe("game_over");
  });

  it("transitions to game_over on colony death", () => {
    const state = new GameState();
    const pm = new PhaseManager();
    pm.startGame(state);
    pm.triggerColonyDeath(state);
    expect(state.phase).toBe("game_over");
  });
});
