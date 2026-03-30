import { ROUNDS_BY_MODE, GameMode, AUCTION_RESOURCE_ORDER } from "@mule-game/shared";
import type { GameState } from "../state/GameState.js";

/**
 * Phase order from Planet M.U.L.E. decompilation:
 *
 * LAND_GRANT → LAND_AUCTION → PLAYER_EVENT → COLONY_EVENT_A →
 * DEVELOPMENT → PRODUCTION → COLONY_EVENT_B →
 * [COLLECTION → AUCTION] x4 (smithore, crystite, food, energy) →
 * SUMMARY
 *
 * The collection+auction pair repeats for each resource in order.
 * We track which resource we're on via auctionResourceIndex.
 */

const PHASE_ORDER = [
  "intro",
  "land_grant",
  "land_auction",
  "player_event",
  "colony_event_a",
  "development",
  "production",
  "colony_event_b",
  "collection",        // repeats per resource
  "trading_auction",   // repeats per resource
  "summary",
] as const;

export class PhaseManager {
  private auctionResourceIndex = 0;

  startGame(state: GameState): void {
    state.round = 1;
    state.phase = PHASE_ORDER[0];
    this.auctionResourceIndex = 0;
  }

  advancePhase(state: GameState): void {
    const current = state.phase;

    // After trading_auction: either next resource's collection, or summary
    if (current === "trading_auction") {
      this.auctionResourceIndex++;
      if (this.auctionResourceIndex < AUCTION_RESOURCE_ORDER.length) {
        // Next resource — back to collection
        state.phase = "collection";
      } else {
        // All 4 resources done — move to summary
        state.phase = "summary";
      }
      return;
    }

    // After summary: next round or game over
    if (current === "summary") {
      const totalRounds = ROUNDS_BY_MODE[state.mode as GameMode] ?? 12;
      if (state.round >= totalRounds) {
        state.phase = "game_over";
      } else {
        state.round += 1;
        this.auctionResourceIndex = 0;
        state.phase = PHASE_ORDER[0];
      }
      return;
    }

    // Normal linear progression
    const currentIndex = PHASE_ORDER.indexOf(current as any);
    if (currentIndex >= 0 && currentIndex < PHASE_ORDER.length - 1) {
      state.phase = PHASE_ORDER[currentIndex + 1];
    }
  }

  /** Get the current auction resource (smithore/crystite/food/energy) */
  getCurrentAuctionResource(): string {
    return AUCTION_RESOURCE_ORDER[this.auctionResourceIndex] ?? "";
  }

  getAuctionResourceIndex(): number {
    return this.auctionResourceIndex;
  }

  triggerColonyDeath(state: GameState): void {
    state.phase = "game_over";
  }
}
