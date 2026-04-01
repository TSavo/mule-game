import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_WIDTH,
  TILE_HEIGHT,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
} from "../config.js";
import { TileRenderer } from "../ui/TileRenderer.js";
import { HUD } from "../ui/HUD.js";
import { TownView } from "../views/TownView.js";
import { Avatar } from "../sprites/Avatar.js";
import type { GameClient } from "../network/GameClient.js";
import type { StateSync } from "../network/StateSync.js";
import type { Room } from "@colyseus/sdk";
import type { TownAction } from "../views/TownView.js";

const TOWN_ROW = 2;
const TOWN_COL = 4;

const MAP_MIN_X = MAP_OFFSET_X;
const MAP_MAX_X = MAP_OFFSET_X + 9 * TILE_WIDTH;
const MAP_MIN_Y = MAP_OFFSET_Y;
const MAP_MAX_Y = MAP_OFFSET_Y + 5 * TILE_HEIGHT;

export class MapScene extends Phaser.Scene {
  private gameClient!: GameClient;
  private stateSync!: StateSync;
  private room!: Room;
  private tileRenderer!: TileRenderer;
  private hud!: HUD;
  private townView!: TownView;
  private avatar!: Avatar;
  private cursorGraphics!: Phaser.GameObjects.Graphics;
  private wampusGraphics!: Phaser.GameObjects.Graphics;
  private wampusText?: Phaser.GameObjects.Text;
  private wampusImage?: Phaser.GameObjects.Image;
  private wampusFlashTimer?: Phaser.Time.TimerEvent;
  private centerText!: Phaser.GameObjects.Text;
  private eventImage?: Phaser.GameObjects.Image;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyB!: Phaser.Input.Keyboard.Key;
  private key1!: Phaser.Input.Keyboard.Key;
  private key2!: Phaser.Input.Keyboard.Key;
  private key3!: Phaser.Input.Keyboard.Key;
  private key4!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;

  private inTownView = false;
  private currentPhase = "";
  private cursorRow = 0;
  private cursorCol = 0;
  private highlightedTileKey = "";
  private wasMoving = false;
  private timerTickingPlaying = false;
  private stepsInsidePlaying = false;
  private eventSoundPlayed = false;

  constructor() {
    super({ key: "MapScene" });
  }

  init(): void {
    this.gameClient = this.registry.get("gameClient");
    this.stateSync = this.registry.get("stateSync");
    this.room = this.registry.get("room");
  }

  create(): void {
    // Reset state
    this.inTownView = false;
    this.currentPhase = "";

    // Tile map
    this.tileRenderer = new TileRenderer(this);
    this.cursorGraphics = this.add.graphics().setDepth(100);
    this.wampusGraphics = this.add.graphics();

    // HUD
    this.hud = new HUD(this);

    // Town view (hidden initially)
    this.townView = new TownView(this);

    // Center text for phase announcements
    this.centerText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", {
        fontSize: "28px",
        fontFamily: "monospace",
        color: "#f39c12",
        align: "center",
        wordWrap: { width: GAME_WIDTH - 80 },
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);

    // Avatar — find local player index and color
    const state = this.stateSync.getState();
    let playerIndex = 0;
    let playerColor = "red";
    if (state?.players) {
      state.players.forEach((p: any) => {
        if (!p.isAI) {
          playerIndex = p.index;
          playerColor = p.color ?? "red";
        }
      });
    }
    const townPos = this.tileRenderer.getTilePosition(TOWN_ROW, TOWN_COL);
    this.avatar = new Avatar(
      this,
      townPos.x,
      townPos.y,
      playerIndex,
      playerColor,
    );
    this.avatar.setVisible(false);

    // Keyboard
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keySpace = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    this.keyEsc = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
    this.keyB = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.key1 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.key2 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.key3 = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.THREE,
    );
    this.key4 = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.FOUR,
    );
    this.keyP = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyL = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L);

    // Render initial map
    this.renderFullMap();

    // Pointer clicks
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (this.currentPhase === "land_grant") {
        this.sound.play("sfx_claim");
        this.tileRenderer.playClaim(this.cursorRow, this.cursorCol);
        this.gameClient.claimPlot();
        return;
      }

      if (this.currentPhase === "development" && !this.inTownView) {
        // Install mule on click if carrying one
        const col = Math.floor((ptr.x - MAP_OFFSET_X) / TILE_WIDTH);
        const row = Math.floor((ptr.y - MAP_OFFSET_Y) / TILE_HEIGHT);
        if (col >= 0 && col < 9 && row >= 0 && row < 5) {
          this.gameClient.installMule(row, col);
          this.sound.play("sfx_build");
          this.avatar.dropMule();
        }
      }
    });

    // Pointer hover for factory highlights on owned tiles with MULEs
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      const col = Math.floor((ptr.x - MAP_OFFSET_X) / TILE_WIDTH);
      const row = Math.floor((ptr.y - MAP_OFFSET_Y) / TILE_HEIGHT);
      const newKey = (col >= 0 && col < 9 && row >= 0 && row < 5) ? `${row},${col}` : "";

      if (newKey === this.highlightedTileKey) return;

      // Remove old highlight
      this.tileRenderer.hideAllFactoryHighlights();
      this.highlightedTileKey = "";

      if (!newKey) return;

      // Check if tile is owned with an installed MULE
      const tileState = this.stateSync.getState();
      if (!tileState?.tiles) return;
      let matchedTile: any = null;
      tileState.tiles.forEach((t: any) => {
        if (t.row === row && t.col === col) matchedTile = t;
      });
      if (matchedTile && matchedTile.owner >= 0 && matchedTile.installedMule) {
        this.tileRenderer.showFactoryHighlight(row, col, matchedTile.installedMule);
        this.highlightedTileKey = newKey;
      }
    });

    // StateSync events
    this.stateSync.on("phase_changed", (phase: string) =>
      this.onPhaseChanged(phase),
    );
    this.stateSync.on("round_changed", (round: number) =>
      this.hud.update({ round }),
    );
    this.stateSync.on("cursor_moved", (row: number, col: number) => {
      this.cursorRow = row;
      this.cursorCol = col;
      this.tileRenderer.drawCursor(row, col, this.cursorGraphics);
    });
    this.stateSync.on("tiles_updated", () => this.renderFullMap());
    this.stateSync.on("event_message", (msg: string) => {
      this.hud.update({ info: msg });
      if (msg) this.sound.play("sfx_player_message");
    });
    this.stateSync.on("turn_timer", (ms: number) => {
      this.hud.update({ timer: ms > 0 ? Math.ceil(ms / 1000) : 0 });
      // Timer ticking during last 5 seconds of development
      if (this.currentPhase === "development" && ms > 0 && ms <= 5000) {
        if (!this.timerTickingPlaying) {
          this.sound.play("sfx_timer", { loop: true, volume: 0.5 });
          this.timerTickingPlaying = true;
        }
      } else if (this.timerTickingPlaying) {
        this.sound.stopByKey("sfx_timer");
        this.timerTickingPlaying = false;
      }
    });
    this.stateSync.on("player_updated", () => this.updateHUDResources());
    this.stateSync.on(
      "wampus_changed",
      (visible: boolean, row: number, col: number) =>
        this.updateWampus(visible, row, col),
    );

    // Check initial phase and launch overlay if needed (e.g. coming from LobbyScene during intro)
    const initialState = this.stateSync.getState();
    const initialPhase = initialState?.phase ?? "";
    if (initialPhase) {
      this.onPhaseChanged(initialPhase);
    }
  }

  update(_time: number, delta: number): void {
    this.stateSync?.poll();

    switch (this.currentPhase) {
      case "intro":
        // IntroScene handles this phase display
        break;
      case "land_grant":
        this.updateLandGrant();
        break;
      case "land_auction":
        this.updateLandAuction();
        break;
      case "development":
        this.updateDevelopment(delta);
        break;
      case "player_event":
      case "colony_event_a":
      case "colony_event_b":
        this.updateEventPhase();
        break;
      case "production":
        this.updateProduction();
        break;
      default:
        break;
    }
  }

  // --------------- Phase update methods ---------------

  private updateLandGrant(): void {
    this.hideCenterText();
    this.avatar.setVisible(false);
    // Cursor rendering is handled by cursor_moved event
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.sound.play("sfx_claim");
      this.tileRenderer.playClaim(this.cursorRow, this.cursorCol);
      this.gameClient.claimPlot();
    }
  }

  private updateLandAuction(): void {
    this.showCenterText("LAND AUCTION");
    this.avatar.setVisible(false);
    // Server handles AI bidding. Human can bid.
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.gameClient.bid(0);
    }
  }

  private updateDevelopment(delta: number): void {
    this.hideCenterText();
    this.avatar.setVisible(true);

    // Arrow key movement
    let moving = false;
    if (this.cursors.up.isDown) {
      this.avatar.moveDirection("north");
      moving = true;
    } else if (this.cursors.down.isDown) {
      this.avatar.moveDirection("south");
      moving = true;
    } else if (this.cursors.left.isDown) {
      this.avatar.moveDirection("west");
      moving = true;
    } else if (this.cursors.right.isDown) {
      this.avatar.moveDirection("east");
      moving = true;
    }

    if (moving) {
      this.avatar.update(delta);
      // Start footstep loop when moving
      if (!this.wasMoving) {
        const stepsKey = this.inTownView ? "sfx_steps_inside" : "sfx_steps_outside";
        if (!this.sound.get(stepsKey)?.isPlaying) {
          this.sound.play(stepsKey, { loop: true, volume: 0.4 });
        }
        this.wasMoving = true;
      }
    } else if (this.wasMoving) {
      // Stop footstep loops when idle
      this.sound.stopByKey("sfx_steps_outside");
      this.sound.stopByKey("sfx_steps_inside");
      this.wasMoving = false;
    }

    // Clamp avatar to map bounds
    this.clampAvatarToMapBounds();

    if (this.inTownView) {
      this.updateTownView();
    } else {
      this.updateMapView();
    }
  }

  private updateTownView(): void {
    // Check building overlap
    const overlapAction = this.townView.checkBuildingOverlap(this.avatar);
    if (overlapAction) {
      this.handleTownAction(overlapAction);
    }

    // Walk into buildings only — no keyboard shortcuts (matches Java)
    // ESC exits town view back to map
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.exitTownView();
    }
  }

  private updateMapView(): void {
    // Check if avatar walked onto town tile
    const tile = this.avatar.getTile(
      MAP_OFFSET_X,
      MAP_OFFSET_Y,
      TILE_WIDTH,
      TILE_HEIGHT,
    );
    if (tile.row === TOWN_ROW && tile.col === TOWN_COL) {
      this.enterTownView();
      return;
    }

    // SPACE: install MULE if carrying one on an owned tile, otherwise end turn
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      if (this.avatar.carrying) {
        const { row, col } = this.avatar.getTile(MAP_OFFSET_X, MAP_OFFSET_Y, TILE_WIDTH, TILE_HEIGHT);
        this.gameClient.installMule(row, col);
        this.sound.play("sfx_build");
        this.avatar.dropMule();
      } else {
        this.sound.play("sfx_count");
        this.gameClient.endTurn();
      }
    }
  }

  private static readonly EVENT_IMAGES: Record<string, string> = {
    pirate: "event_pirate",
    acid: "event_acidrain",
    sunspot: "event_sunspots",
    fire: "event_fire",
    pest: "event_pest",
    radiation: "event_fire",
    meteor: "event_meteor_sprite",
  };

  private static readonly EVENT_SOUNDS: Record<string, string> = {
    pirate: "sfx_pirates",
    earthquake: "sfx_earthquake",
    sunspot: "sfx_solar_wind",
    pest: "sfx_vermin",
    fire: "sfx_fire_upgraded",
    meteor: "sfx_meteor_impact",
    radiation: "sfx_radioactivity",
  };

  private updateEventPhase(): void {
    const state = this.stateSync.getState();
    const msg = state?.eventMessage ?? "";
    this.showCenterText(msg || this.currentPhase.toUpperCase().replace("_", " "));
    this.showEventImage(msg);

    // Play event sound once per event phase
    if (!this.eventSoundPlayed && msg) {
      const lower = msg.toLowerCase();
      for (const [keyword, soundKey] of Object.entries(MapScene.EVENT_SOUNDS)) {
        if (lower.includes(keyword)) {
          this.sound.play(soundKey);
          this.eventSoundPlayed = true;
          break;
        }
      }
    }
  }

  private showEventImage(eventMessage: string): void {
    const lower = eventMessage.toLowerCase();
    let matchedKey: string | undefined;
    for (const [keyword, imageKey] of Object.entries(MapScene.EVENT_IMAGES)) {
      if (lower.includes(keyword) && this.textures.exists(imageKey)) {
        matchedKey = imageKey;
        break;
      }
    }

    if (!matchedKey) {
      if (this.eventImage) {
        this.eventImage.setVisible(false);
      }
      return;
    }

    const imgX = GAME_WIDTH / 2;
    const imgY = GAME_HEIGHT / 2 - 80;

    if (!this.eventImage) {
      this.eventImage = this.add
        .image(imgX, imgY, matchedKey)
        .setDisplaySize(200, 150)
        .setOrigin(0.5)
        .setDepth(200);
    } else {
      this.eventImage
        .setTexture(matchedKey)
        .setPosition(imgX, imgY)
        .setDisplaySize(200, 150)
        .setVisible(true);
    }

    // Push center text below the image
    this.centerText.setY(GAME_HEIGHT / 2 + 20);
  }

  private hideEventImage(): void {
    if (this.eventImage) {
      this.eventImage.setVisible(false);
    }
    // Restore center text to default position
    this.centerText.setY(GAME_HEIGHT / 2);
  }

  private updateProduction(): void {
    this.showCenterText("PRODUCTION");
  }

  // --------------- Town view helpers ---------------

  private enterTownView(): void {
    this.inTownView = true;
    this.townView.show(this.avatar);
    // Switch to indoor footsteps
    this.sound.stopByKey("sfx_steps_outside");
    if (!this.stepsInsidePlaying) {
      this.stepsInsidePlaying = true;
    }
  }

  private exitTownView(): void {
    this.inTownView = false;
    this.townView.hide();
    // Stop indoor footsteps
    this.sound.stopByKey("sfx_steps_inside");
    this.stepsInsidePlaying = false;
    // Place avatar at town tile center
    const townPos = this.tileRenderer.getTilePosition(TOWN_ROW, TOWN_COL);
    this.avatar.setPosition(townPos.x, townPos.y);
  }

  private handleTownAction(action: TownAction): void {
    if (!action) return;

    switch (action.type) {
      case "buy_mule":
        this.sound.play("sfx_buy_register");
        this.gameClient.buyMule();
        this.avatar.pickUpMule("pending");
        break;
      case "outfit_mule":
        this.sound.play("sfx_outfit");
        this.gameClient.outfitMule(action.resource);
        this.avatar.pickUpMule(action.resource);
        break;
      case "visit_pub":
        this.sound.play("sfx_pub");
        this.gameClient.visitPub();
        break;
      case "assay":
        this.sound.play("sfx_buy_assay");
        this.room?.send("assay", {});
        break;
      case "sell_plot":
        this.sound.play("sfx_unbuild");
        break;
    }
  }

  private getPressedTownKey(): string | null {
    if (Phaser.Input.Keyboard.JustDown(this.keyB)) return "B";
    if (Phaser.Input.Keyboard.JustDown(this.key1)) return "1";
    if (Phaser.Input.Keyboard.JustDown(this.key2)) return "2";
    if (Phaser.Input.Keyboard.JustDown(this.key3)) return "3";
    if (Phaser.Input.Keyboard.JustDown(this.key4)) return "4";
    if (Phaser.Input.Keyboard.JustDown(this.keyP)) return "P";
    if (Phaser.Input.Keyboard.JustDown(this.keyA)) return "A";
    if (Phaser.Input.Keyboard.JustDown(this.keyL)) return "L";
    return null;
  }

  // --------------- Map rendering ---------------

  private renderFullMap(): void {
    const state = this.stateSync?.getState();
    if (!state?.tiles || !state?.players) return;
    const colorMap = new Map<number, string>();
    state.players.forEach((p: any) => colorMap.set(p.index, p.color));
    state.tiles.forEach((tile: any) => {
      this.tileRenderer.renderTile(
        tile.row,
        tile.col,
        tile.terrain,
        tile.owner,
        tile.installedMule,
        colorMap.get(tile.owner) ?? "",
        tile.crystiteLevel,
        tile.crystiteRevealed,
        tile.smithoreLevel,
        tile.lastProduction,
        tile.hadEnergy,
      );
    });
  }

  // --------------- HUD ---------------

  private updateHUDResources(): void {
    const state = this.stateSync?.getState();
    if (!state?.players) return;
    let local: any = null;
    state.players.forEach((p: any) => {
      if (!p.isAI && !local) local = p;
    });
    if (!local) return;

    this.hud.update({
      money: local.money,
      food: local.food,
      energy: local.energy,
      smithore: local.smithore,
      crystite: local.crystite,
      prevFood: local.prevFood,
      prevEnergy: local.prevEnergy,
    });
  }

  // --------------- Wampus ---------------

  private updateWampus(visible: boolean, row: number, col: number): void {
    this.wampusGraphics.clear();
    if (this.wampusText) {
      this.wampusText.setVisible(false);
    }
    if (this.wampusImage) {
      this.wampusImage.setVisible(false);
    }
    if (this.wampusFlashTimer) {
      this.wampusFlashTimer.remove();
      this.wampusFlashTimer = undefined;
    }

    if (visible && row >= 0 && col >= 0) {
      this.sound.play("sfx_wumpus");
      const pos = this.tileRenderer.getTilePosition(row, col);
      const useSprite = this.textures.exists("wumpus");

      if (useSprite) {
        // Use wumpus sprite image
        if (!this.wampusImage) {
          this.wampusImage = this.add
            .image(pos.x, pos.y, "wumpus")
            .setDisplaySize(TILE_WIDTH - 4, TILE_HEIGHT - 4)
            .setOrigin(0.5)
            .setDepth(15);
        } else {
          this.wampusImage
            .setPosition(pos.x, pos.y)
            .setDisplaySize(TILE_WIDTH - 4, TILE_HEIGHT - 4)
            .setVisible(true);
        }

        let flashOn = true;
        this.wampusFlashTimer = this.time.addEvent({
          delay: 300,
          loop: true,
          callback: () => {
            flashOn = !flashOn;
            if (this.wampusImage)
              this.wampusImage.setAlpha(flashOn ? 1 : 0.3);
          },
        });
      } else {
        // Fallback: red "W" text with red highlight
        this.wampusGraphics.fillStyle(0xff0000, 0.5);
        this.wampusGraphics.fillRect(
          pos.x - TILE_WIDTH / 2 + 2,
          pos.y - TILE_HEIGHT / 2 + 2,
          TILE_WIDTH - 4,
          TILE_HEIGHT - 4,
        );

        if (!this.wampusText) {
          this.wampusText = this.add
            .text(pos.x, pos.y, "W", {
              fontSize: "32px",
              fontFamily: "monospace",
              color: "#ff0000",
              fontStyle: "bold",
            })
            .setOrigin(0.5);
        } else {
          this.wampusText.setPosition(pos.x, pos.y).setVisible(true);
        }

        let flashOn = true;
        this.wampusFlashTimer = this.time.addEvent({
          delay: 300,
          loop: true,
          callback: () => {
            flashOn = !flashOn;
            if (this.wampusText) this.wampusText.setAlpha(flashOn ? 1 : 0.3);
            this.wampusGraphics.clear();
            if (flashOn) {
              this.wampusGraphics.fillStyle(0xff0000, 0.5);
              this.wampusGraphics.fillRect(
                pos.x - TILE_WIDTH / 2 + 2,
                pos.y - TILE_HEIGHT / 2 + 2,
                TILE_WIDTH - 4,
                TILE_HEIGHT - 4,
              );
            }
          },
        });
      }
    }
  }

  // --------------- Center text helper ---------------

  private showCenterText(msg: string): void {
    this.centerText.setText(msg).setVisible(true);
  }

  private hideCenterText(): void {
    this.centerText.setVisible(false);
  }

  // --------------- Avatar bounds clamping ---------------

  private clampAvatarToMapBounds(): void {
    const x = this.avatar.getX();
    const y = this.avatar.getY();
    const clampedX = Phaser.Math.Clamp(x, MAP_MIN_X, MAP_MAX_X);
    const clampedY = Phaser.Math.Clamp(y, MAP_MIN_Y, MAP_MAX_Y);
    if (x !== clampedX || y !== clampedY) {
      this.avatar.setPosition(clampedX, clampedY);
    }
  }

  // --------------- Phase transitions ---------------

  private onPhaseChanged(phase: string): void {
    this.currentPhase = phase;
    this.cursorGraphics.clear();
    this.tileRenderer.clearCursor();
    this.tileRenderer.setCursorPhase(phase);

    // Update HUD phase label
    const labels: Record<string, string> = {
      intro: "INTRO",
      land_grant: "LAND GRANT",
      land_auction: "LAND AUCTION",
      player_event: "PLAYER EVENT",
      colony_event_a: "COLONY EVENT",
      development: "DEVELOPMENT",
      production: "PRODUCTION",
      colony_event_b: "COLONY EVENT",
      collection: "COLLECTION",
      trading_auction: "TRADING AUCTION",
      summary: "ROUND SUMMARY",
      game_over: "GAME OVER",
    };
    this.hud.update({
      phase: labels[phase] ?? phase.toUpperCase().replace("_", " "),
    });

    // Avatar only visible during development
    const showAvatar = phase === "development";
    this.avatar.setVisible(showAvatar);

    // Reset town view on phase change
    if (this.inTownView) {
      this.inTownView = false;
      this.townView.hide();
    }

    // Hide center text and event image by default (phase updates will show them if needed)
    this.hideCenterText();
    this.hideEventImage();

    // Reset event sound flag on phase change
    this.eventSoundPlayed = false;

    // Stop looping sounds on phase change
    this.sound.stopByKey("sfx_steps_outside");
    this.sound.stopByKey("sfx_steps_inside");
    this.sound.stopByKey("sfx_timer");
    this.wasMoving = false;
    this.timerTickingPlaying = false;
    this.stepsInsidePlaying = false;

    // Overlay scenes: hide immediately, stop next frame to avoid drawImage-on-null.
    // Phaser's Canvas renderer draws scenes in the same frame they're stopped,
    // so we must hide first (prevents render) then stop in requestAnimationFrame.
    const overlays = ["AuctionScene", "CollectionScene", "SummaryScene", "IntroScene"];
    for (const key of overlays) {
      try {
        const s = this.scene.get(key);
        if (s?.sys?.settings) s.sys.settings.visible = false;
      } catch {}
    }
    requestAnimationFrame(() => {
      for (const key of overlays) {
        try { this.scene.stop(key); } catch {}
      }
      // Launch the correct overlay for current phase
      const target =
        phase === "trading_auction" ? "AuctionScene" :
        phase === "collection" ? "CollectionScene" :
        phase === "summary" || phase === "game_over" ? "SummaryScene" :
        phase === "intro" ? "IntroScene" :
        null;
      if (target) {
        try { this.scene.launch(target); } catch (e) { console.error(`[MapScene] Failed to launch ${target}:`, e); }
      }
    });
  }
}
