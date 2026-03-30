import { EconomyEngine } from "../economy/EconomyEngine.js";
import type { SeededRNG } from "@mule-game/shared";
import type { GameState } from "../state/GameState.js";

export class ProductionPhase {
  private engine = new EconomyEngine();

  execute(state: GameState, round: number, rng: SeededRNG): void {
    this.engine.snapshotPreProduction(state);
    this.engine.runProduction(state, round, rng);
    this.engine.applySpoilage(state);
    this.engine.manufactureMules(state);
    this.engine.updateMulePrice(state);
    this.engine.updateStorePrices(state);
  }
}
