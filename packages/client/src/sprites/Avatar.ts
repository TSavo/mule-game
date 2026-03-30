import Phaser from "phaser";
import {
  AVATAR_SIZE,
  AVATAR_SPEED,
  MULE_FOLLOW_OFFSET,
  PLAYER_COLORS,
} from "../config";

type Direction = "north" | "south" | "east" | "west" | "idle";

export class Avatar {
  private scene: Phaser.Scene;
  private body: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  private muleSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle | null = null;
  private targetX: number;
  private targetY: number;
  private direction: Direction = "idle";
  private lastMovingDirection: "north" | "south" | "east" | "west" = "south";
  private playerIndex: number;
  private raceKey: string;
  private usesSprite: boolean;
  private muleUsesSprite = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerIndex: number,
    colorKey: string,
  ) {
    this.scene = scene;
    this.playerIndex = playerIndex;
    this.targetX = x;
    this.targetY = y;
    this.raceKey = `race${playerIndex}`;

    const color = PLAYER_COLORS[colorKey] ?? 0xffffff;

    // Use race spritesheet if available, fall back to colored rectangle
    if (scene.textures.exists(this.raceKey)) {
      const sprite = scene.add.sprite(x, y, this.raceKey, 0);
      sprite.setDisplaySize(AVATAR_SIZE, AVATAR_SIZE);
      sprite.play(`${this.raceKey}_idle_south`);
      this.body = sprite;
      this.usesSprite = true;
    } else {
      this.body = scene.add.rectangle(x, y, AVATAR_SIZE, AVATAR_SIZE, color);
      this.usesSprite = false;
    }
    this.body.setOrigin(0.5, 0.5);
    this.body.setDepth(10);
  }

  setPosition(x: number, y: number): void {
    this.body.setPosition(x, y);
    this.targetX = x;
    this.targetY = y;
    this.direction = "idle";

    if (this.usesSprite) {
      (this.body as Phaser.GameObjects.Sprite).play(`${this.raceKey}_idle_${this.lastMovingDirection}`, true);
    }

    if (this.muleSprite) {
      this.muleSprite.setPosition(x, y + MULE_FOLLOW_OFFSET);
      if (this.muleUsesSprite) {
        (this.muleSprite as Phaser.GameObjects.Sprite).play(`mule_idle_${this.lastMovingDirection}`, true);
      }
    }
  }

  moveDirection(dir: "north" | "south" | "east" | "west"): void {
    const prevDirection = this.direction;
    this.direction = dir;
    this.lastMovingDirection = dir;

    // Play walk animation when direction changes
    if (this.usesSprite && dir !== prevDirection) {
      (this.body as Phaser.GameObjects.Sprite).play(`${this.raceKey}_walk_${dir}`, true);
    }

    if (this.muleSprite && this.muleUsesSprite && dir !== prevDirection) {
      (this.muleSprite as Phaser.GameObjects.Sprite).play(`mule_walk_${dir}`, true);
    }
  }

  update(delta: number): void {
    if (this.direction === "idle") return;

    const speed = AVATAR_SPEED * (delta / 1000);

    switch (this.direction) {
      case "north":
        this.targetY -= speed;
        break;
      case "south":
        this.targetY += speed;
        break;
      case "east":
        this.targetX += speed;
        break;
      case "west":
        this.targetX -= speed;
        break;
    }

    const dx = this.targetX - this.body.x;
    const dy = this.targetY - this.body.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) {
      this.body.setPosition(this.targetX, this.targetY);
      this.direction = "idle";

      // Switch to idle animation when stopping
      if (this.usesSprite) {
        (this.body as Phaser.GameObjects.Sprite).play(`${this.raceKey}_idle_${this.lastMovingDirection}`, true);
      }
      if (this.muleSprite && this.muleUsesSprite) {
        (this.muleSprite as Phaser.GameObjects.Sprite).play(`mule_idle_${this.lastMovingDirection}`, true);
      }
    } else {
      const ratio = Math.min(1, speed / dist);
      const newX = this.body.x + dx * ratio;
      const newY = this.body.y + dy * ratio;
      this.body.setPosition(newX, newY);
    }

    if (this.muleSprite) {
      this.muleSprite.setPosition(this.body.x, this.body.y + MULE_FOLLOW_OFFSET);
    }
  }

  pickUpMule(_resource: string): void {
    if (this.muleSprite) return;

    // Use mule_sprite spritesheet if available, fall back to gold rectangle
    if (this.scene.textures.exists("mule_sprite")) {
      const sprite = this.scene.add.sprite(
        this.body.x,
        this.body.y + MULE_FOLLOW_OFFSET,
        "mule_sprite",
        0,
      );
      sprite.setDisplaySize(24, 30);
      sprite.play(`mule_idle_${this.lastMovingDirection}`, true);

      // If avatar is currently walking, sync mule walk animation
      if (this.direction !== "idle") {
        sprite.play(`mule_walk_${this.direction}`, true);
      }

      this.muleSprite = sprite;
      this.muleUsesSprite = true;
    } else {
      this.muleSprite = this.scene.add.rectangle(
        this.body.x,
        this.body.y + MULE_FOLLOW_OFFSET,
        AVATAR_SIZE * 0.8,
        AVATAR_SIZE * 0.5,
        0xffd700,
      );
      this.muleUsesSprite = false;
    }
    this.muleSprite.setOrigin(0.5, 0.5);
    this.muleSprite.setDepth(9);
  }

  dropMule(): void {
    if (this.muleSprite) {
      this.muleSprite.destroy();
      this.muleSprite = null;
      this.muleUsesSprite = false;
    }
  }

  getTile(
    mapOffsetX: number,
    mapOffsetY: number,
    tileW: number,
    tileH: number,
  ): { col: number; row: number } {
    const col = Math.floor((this.body.x - mapOffsetX) / tileW);
    const row = Math.floor((this.body.y - mapOffsetY) / tileH);
    return { col, row };
  }

  setVisible(visible: boolean): void {
    this.body.setVisible(visible);
    if (this.muleSprite) {
      this.muleSprite.setVisible(visible);
    }
  }

  destroy(): void {
    this.body.destroy();
    if (this.muleSprite) {
      this.muleSprite.destroy();
      this.muleSprite = null;
    }
  }

  getX(): number {
    return this.body.x;
  }

  getY(): number {
    return this.body.y;
  }

  getPlayerIndex(): number {
    return this.playerIndex;
  }
}
