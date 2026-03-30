import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, RESOURCE_COLORS, PLAYER_COLORS } from "../config.js";
import type { StateSync } from "../network/StateSync.js";

/** Stage durations in milliseconds */
const STAGE_DURATIONS = [2500, 1000, 2500, 1000, 2500, 1000, 4000, 5000];

/** Bar dimensions */
const BAR_WIDTH = 21;
const BAR_MAX_HEIGHT = 159;
const PX_PER_UNIT = 6;
const ANIM_SPEED = 25; // pixels per second

/** Player bar spacing */
const PLAYER_SPACING = 104;

/** Resource keys in display order */
const RESOURCE_KEYS = ["food", "energy", "smithore", "crystite"] as const;
type ResourceKey = (typeof RESOURCE_KEYS)[number];

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  food: "Food",
  energy: "Energy",
  smithore: "Smithore",
  crystite: "Crystite",
};

const RESOURCE_HEX_COLORS: Record<ResourceKey, string> = {
  food: "#2ecc71",
  energy: "#f39c12",
  smithore: "#95a5a6",
  crystite: "#3498db",
};

const PLAYER_COLOR_ORDER = ["red", "blue", "green", "purple"];

interface PlayerData {
  index: number;
  colorName: string;
  color: number;
  prevFood: number;
  prevEnergy: number;
  prevSmithore: number;
  prevCrystite: number;
  food: number;
  energy: number;
  smithore: number;
  crystite: number;
  spoiledFood: number;
  spoiledEnergy: number;
}

interface BarState {
  graphics: Phaser.GameObjects.Graphics;
  currentHeight: number;
  targetHeight: number;
  x: number;
  baseY: number;
  color: number;
  borderColor: number;
}

/**
 * Computes a darker shade for bar borders by reducing each RGB channel by 40%.
 */
function darkenColor(color: number): number {
  const r = Math.max(0, Math.floor(((color >> 16) & 0xff) * 0.6));
  const g = Math.max(0, Math.floor(((color >> 8) & 0xff) * 0.6));
  const b = Math.max(0, Math.floor((color & 0xff) * 0.6));
  return (r << 16) | (g << 8) | b;
}

function unitsToHeight(units: number): number {
  return Math.min(units * PX_PER_UNIT, BAR_MAX_HEIGHT);
}

export class CollectionScene extends Phaser.Scene {
  private stateSync!: StateSync;
  private players: PlayerData[] = [];
  private round = 0;

  // Stage tracking
  private currentStage = 0;
  private stageElapsed = 0;

  // Bar state: bars[resourceIndex][playerIndex]
  private bars: BarState[][] = [];

  // UI elements
  private titleTexts: Phaser.GameObjects.Text[] = [];
  private stageLabelText!: Phaser.GameObjects.Text;
  private playerLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "CollectionScene" });
  }

  init(): void {
    this.stateSync = this.registry.get("stateSync");
  }

  create(): void {
    // Solid dark background — fully opaque to cover map tiles behind
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e, 1.0);

    const state = this.stateSync.getState();
    this.round = state?.round ?? 1;

    // Gather player data
    this.players = [];
    if (state?.players) {
      state.players.forEach((p: any, _idx: number) => {
        const pIndex: number = p.index ?? _idx;
        const colorName = PLAYER_COLOR_ORDER[pIndex] ?? "red";
        this.players.push({
          index: pIndex,
          colorName,
          color: PLAYER_COLORS[colorName] ?? 0xffffff,
          prevFood: p.prevFood ?? 0,
          prevEnergy: p.prevEnergy ?? 0,
          prevSmithore: p.prevSmithore ?? 0,
          prevCrystite: p.prevCrystite ?? 0,
          food: p.food ?? 0,
          energy: p.energy ?? 0,
          smithore: p.smithore ?? 0,
          crystite: p.crystite ?? 0,
          spoiledFood: p.spoiledFood ?? 0,
          spoiledEnergy: p.spoiledEnergy ?? 0,
        });
      });
    }

    // Sort by player index for consistent ordering
    this.players.sort((a, b) => a.index - b.index);

    // Pad to 4 players with zero data if needed
    while (this.players.length < 4) {
      const idx = this.players.length;
      const colorName = PLAYER_COLOR_ORDER[idx] ?? "red";
      this.players.push({
        index: idx,
        colorName,
        color: PLAYER_COLORS[colorName] ?? 0x555555,
        prevFood: 0, prevEnergy: 0, prevSmithore: 0, prevCrystite: 0,
        food: 0, energy: 0, smithore: 0, crystite: 0,
        spoiledFood: 0, spoiledEnergy: 0,
      });
    }

    // Layout: 4 resource groups spread across 960px
    // Each group: title + 4 player bars
    const groupWidth = 4 * PLAYER_SPACING;
    const totalGroupsWidth = 4 * groupWidth;
    const gapBetweenGroups = (GAME_WIDTH - totalGroupsWidth) / 5;

    const barBaseY = GAME_HEIGHT - 60; // Bottom of bars
    const titleY = 20;

    // Main stage label
    this.stageLabelText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 28, "", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#aaa",
    }).setOrigin(0.5, 0);

    // Create bars for each resource group
    this.bars = [];
    this.titleTexts = [];

    for (let ri = 0; ri < 4; ri++) {
      const resKey = RESOURCE_KEYS[ri];
      const groupStartX = gapBetweenGroups + ri * (groupWidth + gapBetweenGroups);
      const groupCenterX = groupStartX + groupWidth / 2;

      // Resource title
      const titleText = this.add.text(groupCenterX, titleY, `${RESOURCE_LABELS[resKey]} for Round ${this.round}`, {
        fontSize: "13px",
        fontFamily: "monospace",
        color: RESOURCE_HEX_COLORS[resKey],
      }).setOrigin(0.5, 0);
      this.titleTexts.push(titleText);

      // Player bars within this group
      const resourceBars: BarState[] = [];
      const barsStartX = groupStartX + (groupWidth - (4 - 1) * 26 - BAR_WIDTH) / 2;

      for (let pi = 0; pi < 4; pi++) {
        const player = this.players[pi];
        const barX = barsStartX + pi * 26;
        const graphics = this.add.graphics();
        const borderColor = darkenColor(player.color);

        const barState: BarState = {
          graphics,
          currentHeight: 0,
          targetHeight: 0,
          x: barX,
          baseY: barBaseY,
          color: player.color,
          borderColor,
        };
        resourceBars.push(barState);

        // Player color indicator below bars
        if (ri === 0) {
          const label = this.add.text(barX + BAR_WIDTH / 2, barBaseY + 8, `P${pi + 1}`, {
            fontSize: "10px",
            fontFamily: "monospace",
            color: `#${player.color.toString(16).padStart(6, "0")}`,
          }).setOrigin(0.5, 0);
          this.playerLabels.push(label);
        }
      }
      this.bars.push(resourceBars);
    }

    // Initialize stage 0: Previous Units
    this.currentStage = 0;
    this.stageElapsed = 0;
    this.setTargetsForStage(0);

    // Play collection start sound
    this.sound.play("sfx_collection1");

    // Listen for phase changes
    this.stateSync.on("phase_changed", this.onPhaseChanged, this);
  }

  private getPrevValue(player: PlayerData, resKey: ResourceKey): number {
    switch (resKey) {
      case "food": return player.prevFood;
      case "energy": return player.prevEnergy;
      case "smithore": return player.prevSmithore;
      case "crystite": return player.prevCrystite;
    }
  }

  private getCurrentValue(player: PlayerData, resKey: ResourceKey): number {
    switch (resKey) {
      case "food": return player.food;
      case "energy": return player.energy;
      case "smithore": return player.smithore;
      case "crystite": return player.crystite;
    }
  }

  private getSpoilage(player: PlayerData, resKey: ResourceKey): number {
    switch (resKey) {
      case "food": return player.spoiledFood;
      case "energy": return player.spoiledEnergy;
      default: return 0;
    }
  }

  /**
   * Compute production for a resource:
   * production = current - prev + spoilage (for food/energy)
   * production = current - prev (for smithore/crystite)
   */
  private getProduction(player: PlayerData, resKey: ResourceKey): number {
    const curr = this.getCurrentValue(player, resKey);
    const prev = this.getPrevValue(player, resKey);
    const spoiled = this.getSpoilage(player, resKey);
    return Math.max(0, curr - prev + spoiled);
  }

  /**
   * Post-consumption value = prev - food_consumption
   * For food: consumption = prev - (current + spoiled - production) simplifies to
   * We approximate: usage = prev - (prev - usage) but the server doesn't give us
   * explicit usage. We can derive:
   *   current = prev - usage - spoilage + production
   *   usage = prev - current - spoilage + production
   *   But production = current - prev + spoilage => usage always = 0
   *
   * In the original M.U.L.E., "usage" is the food consumed by colonists (typically 3 per round).
   * Since the server gives us prev, current, and spoiled, and production = current - prev + spoiled,
   * the flow is: prev -> -spoilage -> +production -> current.
   * We show: prev -> spoilage -> intermediate -> production -> final.
   *
   * Stages:
   * 0: Previous = prevValue
   * 1: Usage animation (food consumption) - we skip since server doesn't track separately
   * 2: Current (same as previous since no separate usage tracking)
   * 3: Spoilage animation
   * 4: Intermediate (post-spoilage)
   * 5: Production animation
   * 6: Results (final)
   * 7: End (hold)
   */
  private setTargetsForStage(stage: number): void {
    const stageNames = [
      "Previous",
      "",  // computed per-resource below
      "Current",
      "",  // computed per-resource below
      "Intermediate",
      "",  // computed per-resource below
      "Final",
      "",
    ];

    for (let ri = 0; ri < 4; ri++) {
      const resKey = RESOURCE_KEYS[ri];
      for (let pi = 0; pi < this.players.length && pi < 4; pi++) {
        const player = this.players[pi];
        const prev = this.getPrevValue(player, resKey);
        const current = this.getCurrentValue(player, resKey);
        const spoiled = this.getSpoilage(player, resKey);
        const production = this.getProduction(player, resKey);

        // Derive intermediate values
        // postUsage = prev (no separate usage tracking from server)
        const postUsage = prev;
        // postSpoilage = prev - spoiled
        const postSpoilage = Math.max(0, prev - spoiled);
        // final = current
        const final = current;

        let targetUnits: number;
        switch (stage) {
          case 0: // Previous Units
            targetUnits = prev;
            break;
          case 1: // Usage (animate down) - same as prev since no separate usage
            targetUnits = postUsage;
            break;
          case 2: // Current Units (post-usage)
            targetUnits = postUsage;
            break;
          case 3: // Spoilage (animate down)
            targetUnits = postSpoilage;
            break;
          case 4: // Intermediate (post-spoilage)
            targetUnits = postSpoilage;
            break;
          case 5: // Production (animate up)
            targetUnits = final;
            break;
          case 6: // Results
            targetUnits = final;
            break;
          case 7: // End
            targetUnits = final;
            break;
          default:
            targetUnits = 0;
        }

        this.bars[ri][pi].targetHeight = unitsToHeight(targetUnits);
      }
    }

    // Update stage label
    if (stage === 0) {
      this.stageLabelText.setText("Previous");
    } else if (stage === 1) {
      // Check if any player had usage (food consumption)
      // Since we don't track usage separately, show "No Usage"
      this.stageLabelText.setText("No Usage");
    } else if (stage === 2) {
      this.stageLabelText.setText("Current");
    } else if (stage === 3) {
      const anySpoilage = this.players.some(p => p.spoiledFood > 0 || p.spoiledEnergy > 0);
      this.stageLabelText.setText(anySpoilage ? "Spoilage" : "No Spoilage");
    } else if (stage === 4) {
      this.stageLabelText.setText("Intermediate");
    } else if (stage === 5) {
      const anyProduction = RESOURCE_KEYS.some(rk =>
        this.players.some(p => this.getProduction(p, rk) > 0)
      );
      this.stageLabelText.setText(anyProduction ? "Production" : "No Production");
    } else if (stage === 6) {
      this.stageLabelText.setText("Final");
    } else {
      this.stageLabelText.setText("");
    }
  }

  update(_time: number, delta: number): void {
    if (this.currentStage >= 8) return;

    const dt = delta / 1000; // seconds
    this.stageElapsed += delta;

    // Animate bars toward targets
    for (let ri = 0; ri < this.bars.length; ri++) {
      for (let pi = 0; pi < this.bars[ri].length; pi++) {
        const bar = this.bars[ri][pi];
        if (bar.currentHeight !== bar.targetHeight) {
          const diff = bar.targetHeight - bar.currentHeight;
          const step = ANIM_SPEED * dt;
          if (Math.abs(diff) <= step) {
            bar.currentHeight = bar.targetHeight;
          } else {
            bar.currentHeight += Math.sign(diff) * step;
          }
        }
        this.drawBar(bar);
      }
    }

    // Check stage duration
    if (this.stageElapsed >= STAGE_DURATIONS[this.currentStage]) {
      this.currentStage++;
      this.stageElapsed = 0;

      // Play sound effects at key stage transitions
      if (this.currentStage === 1) {
        // Usage stage (bars going down)
        this.sound.play("sfx_bars_down");
      } else if (this.currentStage === 3) {
        // Spoilage stage
        this.sound.play("sfx_spoilage");
      } else if (this.currentStage === 5) {
        // Production stage (bars going up)
        this.sound.play("sfx_bars_up");
        this.sound.play("sfx_production");
        this.sound.play("sfx_production_beep", { volume: 0.3 });
      } else if (this.currentStage === 6) {
        // Results stage
        this.sound.play("sfx_collection2");
        // Check if any crystite was produced
        const anyCrystite = this.players.some(p => this.getProduction(p, "crystite") > 0);
        if (anyCrystite) {
          this.sound.play("sfx_finding");
        }
      }

      if (this.currentStage >= 8) {
        // All stages complete, stop scene
        this.stateSync.off("phase_changed", this.onPhaseChanged, this);
        if (this.scene.isActive()) this.scene.stop();
        return;
      }

      this.setTargetsForStage(this.currentStage);
    }
  }

  private drawBar(bar: BarState): void {
    bar.graphics.clear();
    if (bar.currentHeight <= 0) return;

    const x = bar.x;
    const y = bar.baseY - bar.currentHeight;
    const w = BAR_WIDTH;
    const h = bar.currentHeight;

    // Border (1px darker outline)
    bar.graphics.fillStyle(bar.borderColor, 1);
    bar.graphics.fillRect(x - 1, y - 1, w + 2, h + 2);

    // Fill
    bar.graphics.fillStyle(bar.color, 1);
    bar.graphics.fillRect(x, y, w, h);
  }

  private onPhaseChanged(phase: string): void {
    if (phase !== "collection") {
      this.stateSync.off("phase_changed", this.onPhaseChanged, this);
      if (this.scene.isActive()) this.scene.stop();
    }
  }
}
