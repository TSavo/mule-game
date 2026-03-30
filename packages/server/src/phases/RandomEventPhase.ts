import { selectRandomEvent, RandomEventTarget, PLAYER_EVENT_PROBABILITY, ROUNDS_BY_MODE, GameMode, RANDOM_EVENTS } from "@mule-game/shared";
import type { SeededRNG, RandomEvent } from "@mule-game/shared";
import type { GameState } from "../state/GameState.js";

// Colony event weights for deck generation
const COLONY_EVENT_WEIGHTS: Array<{ id: string; weight: number }> = [
  { id: "pirate_raid", weight: 2 },
  { id: "acid_rain", weight: 3 },
  { id: "sunspot", weight: 3 },
  { id: "planetquake", weight: 2 },
];

export class RandomEventPhase {
  private colonyEventDeck: string[] = [];

  generateColonyEventDeck(rng: SeededRNG): string[] {
    // Build weighted pool
    const pool: string[] = [];
    for (const entry of COLONY_EVENT_WEIGHTS) {
      for (let i = 0; i < entry.weight; i++) {
        pool.push(entry.id);
      }
    }

    // Shuffle and produce enough events for 12 rounds x 2 (A+B) = 24 events
    const deck: string[] = [];
    while (deck.length < 24) {
      const shuffled = rng.shuffle(pool);
      deck.push(...shuffled);
    }

    this.colonyEventDeck = deck.slice(0, 24);
    return this.colonyEventDeck;
  }

  executeColonyEvent(state: GameState, eventId: string): void {
    // Find the colony event definition by id
    const event = (RANDOM_EVENTS as RandomEvent[]).find(
      (e) => e.id === eventId && e.target === RandomEventTarget.Colony
    );
    if (!event) {
      state.eventMessage = "";
      return;
    }

    state.eventMessage = event.description;
    state.players.forEach((p: any) => this.applyToPlayer(p, event.effect));
  }

  /** Draw the next colony event from the pre-generated deck */
  drawColonyEvent(state: GameState): void {
    if (this.colonyEventDeck.length === 0) {
      state.eventMessage = "";
      return;
    }
    const eventId = this.colonyEventDeck.shift()!;
    this.executeColonyEvent(state, eventId);
  }

  execute(state: GameState, rng: SeededRNG, round: number): void {
    // 27.5% chance of a player event per round
    if (rng.next() > PLAYER_EVENT_PROBABILITY) {
      state.eventMessage = "";
      return;
    }

    const event = selectRandomEvent(rng, round);
    state.eventMessage = event.description;

    // Skip colony events in the player event phase (handled by drawColonyEvent)
    if (event.target === RandomEventTarget.Colony) {
      state.eventMessage = "";
      return;
    }

    // Determine player rankings by money
    const rankings: Array<{ index: number; money: number }> = [];
    state.players.forEach((p: any) => {
      rankings.push({ index: p.index, money: p.money });
    });
    rankings.sort((a, b) => b.money - a.money);

    // Only 1 player — skip player-targeted events
    if (rankings.length <= 1) {
      state.eventMessage = "";
      return;
    }

    const leaderIndex = rankings[0].index;
    const worstIndex = rankings[rankings.length - 1].index;

    const totalRounds = ROUNDS_BY_MODE[state.mode as GameMode] ?? 12;

    let targetIndex = -1;
    if (event.target === RandomEventTarget.Leader) {
      targetIndex = leaderIndex;
    } else if (event.target === RandomEventTarget.Trailing) {
      // Good events target trailing player, but NEVER the rank-1 player
      // In the final 2 rounds, always target the worst-ranked player
      if (round >= totalRounds - 1) {
        targetIndex = worstIndex;
      } else {
        // Find the trailing player (least money) who is NOT the leader
        let trailing = -1;
        let trailingMoney = Infinity;
        for (const r of rankings) {
          if (r.index !== leaderIndex && r.money < trailingMoney) {
            trailingMoney = r.money;
            trailing = r.index;
          }
        }
        targetIndex = trailing >= 0 ? trailing : worstIndex;
      }
    }

    if (targetIndex >= 0) {
      const player = state.players.get(String(targetIndex));
      if (player) this.applyToPlayer(player, event.effect, round);
    }
  }

  private applyToPlayer(player: any, effect: any, round: number = 1): void {
    const multiplier = 1 + (round - 1) / 12;
    switch (effect.type) {
      case "money": player.money = Math.max(0, player.money + Math.floor(effect.amount * multiplier)); break;
      case "resource": {
        const r = effect.resource as string;
        if (r in player) player[r] = Math.max(0, player[r] + Math.floor(effect.amount * multiplier));
        break;
      }
      case "pirate_raid": player.crystite = 0; break;
    }
  }
}
