import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TOWN_BUILDINGS } from "../config";
import type { Avatar } from "../sprites/Avatar";

export type TownAction =
  | { type: "buy_mule" }
  | { type: "outfit_mule"; resource: string }
  | { type: "visit_pub" }
  | { type: "assay" }
  | { type: "sell_plot" }
  | null;

const BUILDING_ACTIONS: Record<
  keyof typeof TOWN_BUILDINGS,
  TownAction
> = {
  corral: { type: "buy_mule" },
  food: { type: "outfit_mule", resource: "food" },
  energy: { type: "outfit_mule", resource: "energy" },
  smithore: { type: "outfit_mule", resource: "smithore" },
  crystite: { type: "outfit_mule", resource: "crystite" },
  pub: { type: "visit_pub" },
  assay: { type: "assay" },
  land: { type: "sell_plot" },
};

const KEY_TO_BUILDING: Record<string, keyof typeof TOWN_BUILDINGS> = {
  B: "corral",
  "1": "food",
  "2": "energy",
  "3": "smithore",
  "4": "crystite",
  P: "pub",
  A: "assay",
  L: "land",
};

export class TownView {
  private container: Phaser.GameObjects.Container;
  private active = false;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
    this.container.setDepth(50);
    this.container.setVisible(false);

    // Dark overlay background
    const overlay = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x1a1a2e,
      0.92,
    );
    this.container.add(overlay);

    // Shop background image (from extracted Planet M.U.L.E. assets)
    if (scene.textures.exists("shop")) {
      const shopBg = scene.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "shop")
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.35);
      this.container.add(shopBg);
    }

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, 30, "COLONY TOWN", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#d4c5a9",
    });
    title.setOrigin(0.5, 0);
    this.container.add(title);

    // Buildings
    const entries = Object.entries(TOWN_BUILDINGS) as Array<
      [string, (typeof TOWN_BUILDINGS)[keyof typeof TOWN_BUILDINGS]]
    >;
    for (const [, bld] of entries) {
      const rect = scene.add.rectangle(bld.x, bld.y, bld.w, bld.h, bld.color);
      rect.setStrokeStyle(2, 0xffffff);
      this.container.add(rect);

      const label = scene.add.text(bld.x, bld.y - bld.h / 2 - 14, bld.label, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
      });
      label.setOrigin(0.5, 0.5);
      this.container.add(label);

      const keyText = scene.add.text(
        bld.x,
        bld.y + bld.h / 2 + 14,
        `[${bld.key}]`,
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#aaaaaa",
        },
      );
      keyText.setOrigin(0.5, 0.5);
      this.container.add(keyText);
    }

    // Store MULE image next to the corral building
    if (scene.textures.exists("store_mule")) {
      const corral = TOWN_BUILDINGS.corral;
      const muleImg = scene.add
        .image(corral.x, corral.y + 8, "store_mule")
        .setDisplaySize(60, 50)
        .setOrigin(0.5)
        .setAlpha(0.9);
      this.container.add(muleImg);
    }

    // Help text
    const help = scene.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 30,
      "Arrow keys to move | Walk into building or press key | ESC = back to map",
      {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#888888",
      },
    );
    help.setOrigin(0.5, 0.5);
    this.container.add(help);
  }

  show(avatar: Avatar): void {
    this.active = true;
    this.container.setVisible(true);
    avatar.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
  }

  hide(): void {
    this.active = false;
    this.container.setVisible(false);
  }

  isActive(): boolean {
    return this.active;
  }

  checkBuildingOverlap(avatar: Avatar): TownAction {
    const ax = avatar.getX();
    const ay = avatar.getY();

    const entries = Object.entries(TOWN_BUILDINGS) as Array<
      [keyof typeof TOWN_BUILDINGS, (typeof TOWN_BUILDINGS)[keyof typeof TOWN_BUILDINGS]]
    >;
    for (const [key, bld] of entries) {
      const dx = Math.abs(ax - bld.x);
      const dy = Math.abs(ay - bld.y);
      if (dx < bld.w / 2 + 8 && dy < bld.h / 2 + 8) {
        return BUILDING_ACTIONS[key];
      }
    }
    return null;
  }

  checkKeyAction(keyCode: string): TownAction {
    const upperKey = keyCode.toUpperCase();
    const buildingKey = KEY_TO_BUILDING[upperKey];
    if (buildingKey) {
      return BUILDING_ACTIONS[buildingKey];
    }
    return null;
  }

  destroy(): void {
    this.container.destroy();
  }
}
