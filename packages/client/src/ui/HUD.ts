import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, RESOURCE_COLORS } from "../config";

const BAR_HEIGHT = 24;
const BAR_ALPHA = 0.7;
const FONT_FAMILY = "monospace";
const FONT_SIZE = "13px";
const COLOR_PHASE = "#d4c5a9";
const COLOR_TIMER = "#f39c12";
const COLOR_MONEY = "#2ecc71";
const COLOR_INFO = "#999999";

export interface HUDData {
  phase?: string;
  round?: number;
  timer?: number;
  money?: number;
  food?: number;
  energy?: number;
  smithore?: number;
  crystite?: number;
  prevFood?: number;
  prevEnergy?: number;
  spoiledFood?: number;
  spoiledEnergy?: number;
  info?: string;
}

function hexColorStr(hex: number): string {
  return "#" + hex.toString(16).padStart(6, "0");
}

function deltaStr(current: number, prev: number | undefined): string {
  if (prev === undefined || prev === current) return "";
  const diff = current - prev;
  return ` (${diff > 0 ? "+" : ""}${diff})`;
}

// Icon order in hud_resource_icons.png strip (70x14 = 5 icons at 14x14)
const ICON_SIZE = 14;
const ICON_INDICES = { food: 0, energy: 1, smithore: 2, crystite: 3, money: 4 };

export class HUD {
  private container: Phaser.GameObjects.Container;
  private topBar: Phaser.GameObjects.Rectangle;
  private bottomBar: Phaser.GameObjects.Rectangle;
  private phaseText: Phaser.GameObjects.Text;
  private moneyText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private foodText: Phaser.GameObjects.Text;
  private energyText: Phaser.GameObjects.Text;
  private smithoreText: Phaser.GameObjects.Text;
  private crystiteText: Phaser.GameObjects.Text;
  private infoText: Phaser.GameObjects.Text;
  private resourceIcons: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);

    // --- Top bar ---
    this.topBar = scene.add
      .rectangle(GAME_WIDTH / 2, BAR_HEIGHT / 2, GAME_WIDTH, BAR_HEIGHT, 0x000000, BAR_ALPHA)
      .setOrigin(0.5);

    const textStyle = (color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      color,
    });

    this.phaseText = scene.add
      .text(8, BAR_HEIGHT / 2, "", textStyle(COLOR_PHASE))
      .setOrigin(0, 0.5);

    this.moneyText = scene.add
      .text(GAME_WIDTH / 2, BAR_HEIGHT / 2, "", textStyle(COLOR_MONEY))
      .setOrigin(0.5);

    this.timerText = scene.add
      .text(GAME_WIDTH - 8, BAR_HEIGHT / 2, "", textStyle(COLOR_TIMER))
      .setOrigin(1, 0.5);

    // --- Bottom bar ---
    const bottomY = GAME_HEIGHT - BAR_HEIGHT / 2;
    this.bottomBar = scene.add
      .rectangle(GAME_WIDTH / 2, bottomY, GAME_WIDTH, BAR_HEIGHT, 0x000000, BAR_ALPHA)
      .setOrigin(0.5);

    const resSpacing = GAME_WIDTH / 4;
    const resY = bottomY;

    this.foodText = scene.add
      .text(resSpacing * 0.5, resY, "", textStyle(hexColorStr(RESOURCE_COLORS.food)))
      .setOrigin(0.5);

    this.energyText = scene.add
      .text(resSpacing * 1.5, resY, "", textStyle(hexColorStr(RESOURCE_COLORS.energy)))
      .setOrigin(0.5);

    this.smithoreText = scene.add
      .text(resSpacing * 2.5, resY, "", textStyle(hexColorStr(RESOURCE_COLORS.smithore)))
      .setOrigin(0.5);

    this.crystiteText = scene.add
      .text(resSpacing * 3.5, resY, "", textStyle(hexColorStr(RESOURCE_COLORS.crystite)))
      .setOrigin(0.5);

    // --- Info text (above bottom bar) ---
    this.infoText = scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - BAR_HEIGHT - 6, "", textStyle(COLOR_INFO))
      .setOrigin(0.5, 1);

    // --- Resource icons from hud_icons strip ---
    const hasIcons = scene.textures.exists("hud_icons");
    if (hasIcons) {
      const iconOffsetX = -28; // offset left of text center
      const iconEntries: Array<{ text: Phaser.GameObjects.Text; index: number }> = [
        { text: this.foodText, index: ICON_INDICES.food },
        { text: this.energyText, index: ICON_INDICES.energy },
        { text: this.smithoreText, index: ICON_INDICES.smithore },
        { text: this.crystiteText, index: ICON_INDICES.crystite },
      ];

      for (const entry of iconEntries) {
        const icon = scene.add
          .image(entry.text.x + iconOffsetX, resY, "hud_icons")
          .setOrigin(0.5)
          .setCrop(entry.index * ICON_SIZE, 0, ICON_SIZE, ICON_SIZE)
          .setDisplaySize(ICON_SIZE, ICON_SIZE);
        this.resourceIcons.push(icon);
      }
    }

    this.container.add([
      this.topBar,
      this.phaseText,
      this.moneyText,
      this.timerText,
      this.bottomBar,
      this.foodText,
      this.energyText,
      this.smithoreText,
      this.crystiteText,
      this.infoText,
      ...this.resourceIcons,
    ]);
  }

  update(data: HUDData): void {
    if (data.phase !== undefined || data.round !== undefined) {
      const phase = data.phase ?? "";
      const round = data.round !== undefined ? ` R${data.round}` : "";
      this.phaseText.setText(`${phase}${round}`);
    }

    if (data.money !== undefined) {
      this.moneyText.setText(`$${data.money}`);
    }

    if (data.timer !== undefined) {
      this.timerText.setText(`${data.timer}s`);
    }

    if (data.food !== undefined) {
      const delta = deltaStr(data.food, data.prevFood);
      this.foodText.setText(`F:${data.food}${delta}`);
    }

    if (data.energy !== undefined) {
      const delta = deltaStr(data.energy, data.prevEnergy);
      this.energyText.setText(`E:${data.energy}${delta}`);
    }

    if (data.smithore !== undefined) {
      this.smithoreText.setText(`S:${data.smithore}`);
    }

    if (data.crystite !== undefined) {
      this.crystiteText.setText(`C:${data.crystite}`);
    }

    if (data.info !== undefined) {
      this.infoText.setText(data.info);
    }
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}
