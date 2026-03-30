import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: "BootScene" }); }

  preload(): void {
    const { width, height } = this.cameras.main;

    // Loading bar UI
    const bar = this.add.graphics();
    const box = this.add.graphics();
    box.fillStyle(0x222222, 0.8);
    box.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    this.load.on("progress", (v: number) => {
      bar.clear(); bar.fillStyle(0x4a90d9, 1);
      bar.fillRect(width / 2 - 150, height / 2 - 15, 300 * v, 30);
    });
    this.load.on("complete", () => { bar.destroy(); box.destroy(); });

    // --- Tiles ---
    this.load.image("tile_plain", "assets/skins/default/tiles_plain.png");
    this.load.image("tile_desert", "assets/skins/default/tiles_desert.png");
    this.load.image("tile_river", "assets/skins/default/tiles_river.png");
    this.load.image("tile_crater", "assets/skins/default/tiles_crater.png");
    this.load.image("tile_shop", "assets/skins/default/tiles_shop.png");

    // --- Decals ---
    this.load.image("decal_mountains", "assets/skins/default/decals_mountains.png");
    this.load.image("decal_water", "assets/skins/default/decals_water.png");
    this.load.image("decal_small_water", "assets/skins/default/decals_small_water.png");
    this.load.image("decal_dirt", "assets/skins/default/decals_dirt.png");

    // --- Buildings / factories ---
    this.load.spritesheet("factories", "assets/skins/default/factories.png", { frameWidth: 60, frameHeight: 34 });
    this.load.image("factory_highlights", "assets/skins/default/factory_highlights.png");
    this.load.spritesheet("factory_low_energy", "assets/skins/default/factory_low_energy.png", { frameWidth: 52, frameHeight: 34 });

    // --- Land grant / auction overlays ---
    this.load.image("land_grant_frame", "assets/skins/default/land_grant_frame.png");
    this.load.image("land_auction_frame", "assets/skins/default/land_auction_frame.png");
    this.load.image("plot_border", "assets/skins/default/plot_border.png");
    this.load.image("claim_effect", "assets/skins/default/claim_effect.png");

    // --- Production ---
    this.load.image("production_bit", "assets/skins/default/production_bit.png");
    this.load.image("production_none", "assets/skins/default/production_none.png");

    // --- Borders ---
    this.load.image("border_corners", "assets/skins/default/border_corners.png");
    this.load.image("border_left_right", "assets/skins/default/border_left_right.png");
    this.load.image("border_top_bottom", "assets/skins/default/border_top_bottom.png");

    // --- Sprites: mules & followers ---
    this.load.spritesheet("mule_sprite", "assets/images/followers/sprite-mule.png", { frameWidth: 64, frameHeight: 80 });
    this.load.spritesheet("mule_small", "assets/images/followers/sprite-mule-small.png", { frameWidth: 32, frameHeight: 40 });
    this.load.image("assaybot", "assets/images/followers/assaybot.png");
    this.load.image("assaybot_small", "assets/images/followers/assaybot-small.png");
    for (let i = 0; i <= 3; i++) {
      this.load.image(`packet${i}`, `assets/images/followers/sprite-packet-${i}.png`);
      this.load.image(`packet${i}_small`, `assets/images/followers/sprite-packet-${i}-small.png`);
    }

    // --- Wumpus ---
    this.load.image("wumpus", "assets/images/wumpus/wumpus.png");
    this.load.image("wumpus_cave", "assets/images/wumpus/wumpus_cave.png");

    // --- Races (avatars) ---
    for (let i = 0; i <= 7; i++) {
      this.load.spritesheet(`race${i}`, `assets/images/races/race${i}.png`, { frameWidth: 32, frameHeight: 48 });
      this.load.spritesheet(`race${i}_small`, `assets/images/races/race${i}-small.png`, { frameWidth: 16, frameHeight: 24 });
    }

    // --- Shop / town ---
    this.load.image("shop", "assets/images/shop.png");
    this.load.image("shop_assay", "assets/images/shop_assay_bot.png");
    this.load.image("store_mule", "assets/images/store-mule.png");

    // --- UI ---
    this.load.image("terminal", "assets/images/terminal.png");
    this.load.image("hud_icons", "assets/images/hud_resource_icons.png");
    this.load.image("hudlights", "assets/images/hudlights.png");

    // --- Frame / splash ---
    this.load.image("splash", "assets/frame/splash.png");
    this.load.image("planet_mule_logo", "assets/frame/planet_mule.png");
    this.load.image("login_bg", "assets/frame/login_background.png");

    // --- Intro ---
    this.load.image("ship", "assets/images/intro/ship.png");
    this.load.image("ship_dust", "assets/images/intro/ship_dust.png");
    this.load.image("ship_thrust", "assets/images/intro/ship_thrust.png");

    // --- Auction ---
    this.load.image("auction_bg", "assets/images/auction3/auction_background.png");
    this.load.image("auction_signs", "assets/images/auction3/auction_signs.png");
    this.load.image("auction_line_dashed", "assets/images/auction3/auction_line_dashed.png");
    this.load.image("auction_line_solid", "assets/images/auction3/auction_line_solid.png");
    this.load.image("auction_line_contact", "assets/images/auction3/auction_line_contact.png");
    this.load.image("auction_lights", "assets/images/auction3/auction_lights.png");

    // --- Auction resource headers (auction4) ---
    this.load.image("auction_header_food", "assets/images/auction4/auction_header_food.png");
    this.load.image("auction_header_energy", "assets/images/auction4/auction_header_energy.png");
    this.load.image("auction_header_smithore", "assets/images/auction4/auction_header_smithore.png");
    this.load.image("auction_header_crystite", "assets/images/auction4/auction_header_crystite.png");
    this.load.image("auction_header_land", "assets/images/auction4/auction_header_land.png");
    this.load.image("auction_monitorfuzz", "assets/images/auction3/auction_monitorfuzz.png");
    this.load.image("auction_text", "assets/images/auction3/auction_text.png");

    // --- Events ---
    this.load.image("event_pirate", "assets/images/events/pirate_ship.png");
    this.load.image("event_acidrain", "assets/images/events/acidrain.png");
    this.load.image("event_sunspots", "assets/images/events/sunspots.png");
    this.load.image("event_fire", "assets/images/events/shopfire.png");
    this.load.image("event_pest", "assets/images/events/pest.png");
    this.load.image("event_meteor_plot", "assets/images/events/meteor_plot.png");
    this.load.image("event_meteor_shadow", "assets/images/events/meteor_shadow.png");
    this.load.image("event_meteor_sprite", "assets/images/events/meteor_sprite.png");
    this.load.image("event_mulefault", "assets/images/events/mulefault.png");

    // --- Summary ---
    this.load.image("summary_bg", "assets/images/summary/summary.png");
    this.load.image("summary_header", "assets/images/summary/summary_header.png");

    // --- Misc ---
    this.load.image("map_borders", "assets/images/map_borders.png");
    this.load.image("land_ping", "assets/images/land_ping.png");
    this.load.image("hire_frame", "assets/images/hire-frame.png");
    this.load.image("assay_signs", "assets/skins/default/assay_signs.png");

    // Generate fallback player_avatar placeholder (used if race sprite not available)
    const avatar = this.make.graphics({ x: 0, y: 0 });
    avatar.fillStyle(0xffffff);
    avatar.fillRect(4, 0, 8, 4); avatar.fillRect(2, 4, 12, 8);
    avatar.fillRect(4, 12, 3, 4); avatar.fillRect(9, 12, 3, 4);
    avatar.generateTexture("player_avatar", 16, 16);
    avatar.destroy();

    // ── Audio: Music ──
    this.load.audio("theme", "assets/music/mule_theme.ogg");
    this.load.audio("theme_short", "assets/music/mule_theme_short.ogg");

    // ── Audio: Sound effects ──
    this.load.audio("sfx_claim", "assets/sounds/claim_land.ogg");
    this.load.audio("sfx_build", "assets/sounds/build.ogg");
    this.load.audio("sfx_unbuild", "assets/sounds/unbuild.ogg");
    this.load.audio("sfx_outfit", "assets/sounds/outfitting_mule.ogg");
    this.load.audio("sfx_pub", "assets/sounds/pub_gambling_alt.wav");
    this.load.audio("sfx_transaction", "assets/sounds/transaction_ended.ogg");
    this.load.audio("sfx_auction_bell", "assets/sounds/auction_bell_ended.wav");
    this.load.audio("sfx_auction_hammer", "assets/sounds/auction_hammer.ogg");
    this.load.audio("sfx_wumpus", "assets/sounds/catch_wumpus_2.ogg");
    this.load.audio("sfx_ship_land", "assets/sounds/ship_landing.ogg");
    this.load.audio("sfx_ship_takeoff", "assets/sounds/ship_takeoff.ogg");
    this.load.audio("sfx_bars_up", "assets/sounds/bars_up.ogg");
    this.load.audio("sfx_bars_down", "assets/sounds/bars_down.ogg");
    this.load.audio("sfx_spoilage", "assets/sounds/spoilage_sfx.wav");
    this.load.audio("sfx_production", "assets/sounds/production_alt2.wav");
    this.load.audio("sfx_error", "assets/sounds/error_sound1.ogg");
    this.load.audio("sfx_too_expensive", "assets/sounds/too_expensive.ogg");
    this.load.audio("sfx_steps_outside", "assets/sounds/steps_outside_loop.ogg");
    this.load.audio("sfx_steps_inside", "assets/sounds/steps_inside_loop.ogg");
    this.load.audio("sfx_win", "assets/sounds/winning_tune_1.ogg");
    this.load.audio("sfx_lose", "assets/sounds/loosing_tune_2.ogg");
    this.load.audio("sfx_timer", "assets/sounds/timer_ticking_alt_1.wav");
    this.load.audio("sfx_earthquake", "assets/sounds/earthquake.ogg");
    this.load.audio("sfx_pirates", "assets/sounds/pirates_ufo.ogg");
    this.load.audio("sfx_count", "assets/sounds/count.wav");
    this.load.audio("sfx_new_game", "assets/sounds/new_game.ogg");

    // ── Audio: Additional sound effects ──
    this.load.audio("sfx_buy_assay", "assets/sounds/buy_assay.ogg");
    this.load.audio("sfx_buy_energy", "assets/sounds/buy_energy.ogg");
    this.load.audio("sfx_buy_register", "assets/sounds/buy_registrer.ogg");
    this.load.audio("sfx_collection1", "assets/sounds/collection_sound_alt1.wav");
    this.load.audio("sfx_collection2", "assets/sounds/collection_sound_alt2.wav");
    this.load.audio("sfx_count_go", "assets/sounds/count_go.wav");
    this.load.audio("sfx_error2", "assets/sounds/error_sound2.ogg");
    this.load.audio("sfx_finding", "assets/sounds/finding_sfx.ogg");
    this.load.audio("sfx_fire_upgraded", "assets/sounds/fire_upgraded.ogg");
    this.load.audio("sfx_crystal1", "assets/sounds/found_crystal1.ogg");
    this.load.audio("sfx_crystal3", "assets/sounds/found_crystal3.ogg");
    this.load.audio("sfx_click", "assets/sounds/klick3.wav");
    this.load.audio("sfx_meteor_impact", "assets/sounds/meteor_impact.ogg");
    this.load.audio("sfx_meteor_tail", "assets/sounds/meteor_tail.ogg");
    this.load.audio("sfx_outfit2", "assets/sounds/outfitting_mule2.ogg");
    this.load.audio("sfx_outfit_layer", "assets/sounds/outfitting_mule_sound_layer.ogg");
    this.load.audio("sfx_outfit_warning", "assets/sounds/outfitting_mule_sound_layer_warning.ogg");
    this.load.audio("sfx_player_message", "assets/sounds/player_message.ogg");
    this.load.audio("sfx_power_down", "assets/sounds/power_down.ogg");
    this.load.audio("sfx_button", "assets/sounds/press_button.wav");
    this.load.audio("sfx_production2", "assets/sounds/production_space_traders.wav");
    this.load.audio("sfx_production_beep", "assets/sounds/productions_sound_beep.wav");
    this.load.audio("sfx_radioactivity", "assets/sounds/radioactivity_mule_go_crazy.ogg");
    this.load.audio("sfx_robo_mule1", "assets/sounds/robo_mule1.ogg");
    this.load.audio("sfx_robo_mule2", "assets/sounds/robo_mule2.ogg");
    this.load.audio("sfx_solar_wind", "assets/sounds/solar_wind.ogg");
    this.load.audio("sfx_spinning_bot", "assets/sounds/spinning_flying_bot.ogg");
    this.load.audio("sfx_storm", "assets/sounds/storm.ogg");
    this.load.audio("sfx_storm_upgraded", "assets/sounds/storm_upgraded.ogg");
    this.load.audio("sfx_timer2", "assets/sounds/timer_ticking (alt 2).ogg");
    this.load.audio("sfx_timer3", "assets/sounds/timer_ticking_alt_3.wav");
    this.load.audio("sfx_timer4", "assets/sounds/timer_ticking_alt_4.wav");
    this.load.audio("sfx_vermin", "assets/sounds/vermin_alarm1.ogg");
    this.load.audio("sfx_blip_error", "assets/sounds/blip_blop_error_sfx.ogg");
  }

  create(): void {
    // --- Race walk/idle animations ---
    for (let i = 0; i <= 7; i++) {
      const key = `race${i}`;
      this.anims.create({ key: `${key}_walk_south`, frames: this.anims.generateFrameNumbers(key, { frames: [3, 4, 5, 6, 7, 8, 1, 2] }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}_walk_north`, frames: this.anims.generateFrameNumbers(key, { frames: [11, 12, 13, 14, 15, 16, 9, 10] }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}_walk_west`, frames: this.anims.generateFrameNumbers(key, { frames: [19, 20, 21, 22, 23, 24, 17, 18] }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}_walk_east`, frames: this.anims.generateFrameNumbers(key, { frames: [27, 28, 29, 30, 31, 32, 25, 26] }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${key}_idle_south`, frames: this.anims.generateFrameNumbers(key, { frames: [0] }), frameRate: 1, repeat: -1 });
      this.anims.create({ key: `${key}_idle_north`, frames: this.anims.generateFrameNumbers(key, { frames: [13] }), frameRate: 1, repeat: -1 });
      this.anims.create({ key: `${key}_idle_west`, frames: this.anims.generateFrameNumbers(key, { frames: [21] }), frameRate: 1, repeat: -1 });
      this.anims.create({ key: `${key}_idle_east`, frames: this.anims.generateFrameNumbers(key, { frames: [29] }), frameRate: 1, repeat: -1 });
    }

    // --- MULE walk/idle animations ---
    this.anims.create({ key: "mule_walk_south", frames: this.anims.generateFrameNumbers("mule_sprite", { frames: [1, 0, 2] }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: "mule_walk_north", frames: this.anims.generateFrameNumbers("mule_sprite", { frames: [4, 3, 5] }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: "mule_walk_west", frames: this.anims.generateFrameNumbers("mule_sprite", { frames: [7, 6, 8] }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: "mule_walk_east", frames: this.anims.generateFrameNumbers("mule_sprite", { frames: [10, 9, 11] }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: "mule_idle_south", frames: this.anims.generateFrameNumbers("mule_sprite", { frames: [0] }), frameRate: 1, repeat: -1 });
    this.anims.create({ key: "mule_idle_north", frames: this.anims.generateFrameNumbers("mule_sprite", { frames: [3] }), frameRate: 1, repeat: -1 });
    this.anims.create({ key: "mule_idle_west", frames: this.anims.generateFrameNumbers("mule_sprite", { frames: [6] }), frameRate: 1, repeat: -1 });
    this.anims.create({ key: "mule_idle_east", frames: this.anims.generateFrameNumbers("mule_sprite", { frames: [9] }), frameRate: 1, repeat: -1 });

    this.scene.start("LobbyScene");
  }
}
