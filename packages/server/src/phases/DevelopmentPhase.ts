import { calculateTurnDuration, OUTFIT_COST, PUB_ROUND_BONUS, PUB_MAX_RANDOM_AMOUNT, WAMPUS_BOUNTY_BY_ROUND, FOOD_REQUIRED_BY_ROUND } from "@mule-game/shared";
import type { GameState } from "../state/GameState.js";

export class DevelopmentPhase {
  private playerOrder: number[] = [];
  private currentIndex = 0;
  private wampusCaught = new Set<number>();

  start(state: GameState, round: number, scores?: number[]): void {
    this.playerOrder = [];
    state.players.forEach((p: any) => this.playerOrder.push(p.index));

    // Sort by score. When M.U.L.E. supply <= 7, worst player goes first;
    // otherwise best player goes first (matches Planet M.U.L.E. decompilation).
    // Fall back to money if scores are all 0 (round 1, before first scoring).
    const scarce = state.store.muleCount <= 7;
    const hasScores = this.playerOrder.some((i) => (state.players.get(String(i))?.score ?? 0) > 0);
    this.playerOrder.sort((a, b) => {
      const playerA = state.players.get(String(a));
      const playerB = state.players.get(String(b));
      const valA = hasScores ? (playerA?.score ?? 0) : (playerA?.money ?? 0);
      const valB = hasScores ? (playerB?.score ?? 0) : (playerB?.money ?? 0);
      return scarce ? valA - valB : valB - valA;
    });

    this.currentIndex = 0;
    this.wampusCaught.clear();
    this.startPlayerTurn(state, round);
  }

  private startPlayerTurn(state: GameState, round: number): void {
    const playerIndex = this.playerOrder[this.currentIndex];
    state.currentPlayerTurn = playerIndex;
    const player = state.players.get(String(playerIndex));
    if (!player) return;

    // Consume food at start of turn (Mechtrons consume 0)
    if (player.species !== "mechtron") {
      const required = FOOD_REQUIRED_BY_ROUND[Math.min(round, FOOD_REQUIRED_BY_ROUND.length - 1)] ?? 3;
      player.food = Math.max(0, player.food - required);
    }

    const duration = calculateTurnDuration(player.food, round, (player as any).species);
    state.turnTimeRemaining = duration;
    player.hasMule = false;
    player.muleOutfit = "";
    player.turnComplete = false;
  }

  buyMule(state: GameState, playerIndex: number): boolean {
    if (state.currentPlayerTurn !== playerIndex) return false;
    const player = state.players.get(String(playerIndex));
    if (!player || player.hasMule) return false;
    if (state.store.muleCount <= 0) return false;
    if (player.money < state.store.mulePrice) return false;
    player.money -= state.store.mulePrice;
    state.store.muleCount -= 1;
    player.hasMule = true;
    return true;
  }

  outfitMule(state: GameState, playerIndex: number, resource: string): boolean {
    if (state.currentPlayerTurn !== playerIndex) return false;
    const player = state.players.get(String(playerIndex));
    if (!player || !player.hasMule || player.muleOutfit !== "") return false;
    const cost = OUTFIT_COST[resource as keyof typeof OUTFIT_COST];
    if (cost === undefined || player.money < cost) return false;
    player.money -= cost;
    player.muleOutfit = resource;
    return true;
  }

  installMule(state: GameState, playerIndex: number, row: number, col: number): boolean {
    if (state.currentPlayerTurn !== playerIndex) return false;
    const player = state.players.get(String(playerIndex));
    if (!player || !player.hasMule || player.muleOutfit === "") return false;
    const tile = state.tiles.find((t: any) => t.row === row && t.col === col);
    if (!tile || tile.owner !== playerIndex || tile.installedMule !== "") return false;
    tile.installedMule = player.muleOutfit;
    player.hasMule = false;
    player.muleOutfit = "";
    return true;
  }

  visitPub(state: GameState, playerIndex: number): number {
    if (state.currentPlayerTurn !== playerIndex) return 0;
    const player = state.players.get(String(playerIndex));
    if (!player || player.hasMule) return 0;
    const fraction = Math.min(state.turnTimeRemaining / 47_500, 1.0);
    const roundIndex = state.round ?? 0;
    const roundBonus = PUB_ROUND_BONUS[Math.min(roundIndex, PUB_ROUND_BONUS.length - 1)] ?? 0;
    let payout = Math.min(roundBonus + Math.floor(Math.random() * fraction * PUB_MAX_RANDOM_AMOUNT), 250);
    // Flapper species bonus: double pub payout (before cap)
    if ((player as any).species === "flapper") {
      payout = Math.min(payout * 2, 250);
    }
    player.money += payout;
    player.turnComplete = true;
    return payout;
  }

  assayOffice(state: GameState, playerIndex: number): boolean {
    if (state.currentPlayerTurn !== playerIndex) return false;
    const player = state.players.get(String(playerIndex));
    if (!player || player.money < 50) return false;
    player.money -= 50;
    // Reveal crystite levels on all owned tiles
    state.tiles.forEach((t: any) => {
      if (t.owner === playerIndex) t.crystiteRevealed = true;
    });
    return true;
  }

  sellPlot(state: GameState, playerIndex: number, row: number, col: number): boolean {
    if (state.currentPlayerTurn !== playerIndex) return false;
    const player = state.players.get(String(playerIndex));
    if (!player) return false;
    const tile = state.tiles.find((t: any) => t.row === row && t.col === col);
    if (!tile || tile.owner !== playerIndex) return false;
    tile.owner = -1;
    tile.installedMule = "";
    player.plotCount = Math.max(0, player.plotCount - 1);
    player.money += 500; // LAND_VALUE
    return true;
  }

  catchWampus(state: GameState, playerIndex: number, round: number): number {
    if (state.currentPlayerTurn !== playerIndex) return 0;
    if (this.wampusCaught.has(playerIndex)) return 0;
    const player = state.players.get(String(playerIndex));
    if (!player || player.hasMule) return 0;
    const clampedRound = Math.min(Math.max(round, 1), WAMPUS_BOUNTY_BY_ROUND.length - 1);
    const bounty = WAMPUS_BOUNTY_BY_ROUND[clampedRound];
    player.money += bounty;
    this.wampusCaught.add(playerIndex);
    return bounty;
  }

  endTurn(state: GameState, round: number): boolean {
    const player = state.players.get(String(this.playerOrder[this.currentIndex]));
    if (player) player.turnComplete = true;
    this.currentIndex += 1;
    if (this.currentIndex >= this.playerOrder.length) {
      state.currentPlayerTurn = -1;
      return true;
    }
    this.startPlayerTurn(state, round);
    return false;
  }

  isComplete(): boolean { return this.currentIndex >= this.playerOrder.length; }
}
