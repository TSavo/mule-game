export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const TILE_WIDTH = 80;
export const TILE_HEIGHT = 80;
export const MAP_OFFSET_X = (GAME_WIDTH - 9 * TILE_WIDTH) / 2;
export const MAP_OFFSET_Y = 40;

export const PLAYER_COLORS: Record<string, number> = {
  red: 0xe74c3c, blue: 0x3498db, green: 0x2ecc71, purple: 0x9b59b6,
};

export const TERRAIN_COLORS: Record<string, number> = {
  plains: 0xc4a24e, river: 0x4a90d9, mountain1: 0x8b7355,
  mountain2: 0x6b5b3e, mountain3: 0x4a3c28, town: 0xd4c5a9,
};

export const RESOURCE_COLORS: Record<string, number> = {
  food: 0x2ecc71, energy: 0xf39c12, smithore: 0x95a5a6, crystite: 0x3498db,
};

// In dev (Vite on :3000), connect directly to Colyseus server.
// In production, server serves both client and WebSocket (same origin).
export const SERVER_URL =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:2567"
    : typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:2567";
export const AUCTION_AREA_HEIGHT = 400;

export const AVATAR_SIZE = 24;
export const AVATAR_SPEED = 200; // pixels per second
export const MULE_FOLLOW_OFFSET = 16;

export const TOWN_BUILDINGS = {
  corral:   { x: 480, y: 150, w: 120, h: 80, label: "M.U.L.E. CORRAL", key: "B", color: 0x8b7355 },
  food:     { x: 160, y: 280, w: 120, h: 80, label: "FOOD STORE",      key: "1", color: 0x2ecc71 },
  energy:   { x: 320, y: 280, w: 120, h: 80, label: "ENERGY STORE",    key: "2", color: 0xf39c12 },
  smithore: { x: 480, y: 280, w: 120, h: 80, label: "SMITHORE STORE",  key: "3", color: 0x95a5a6 },
  crystite: { x: 640, y: 280, w: 120, h: 80, label: "CRYSTITE STORE",  key: "4", color: 0x3498db },
  assay:    { x: 160, y: 150, w: 120, h: 80, label: "ASSAY OFFICE",    key: "A", color: 0x7f8c8d },
  land:     { x: 800, y: 150, w: 120, h: 80, label: "LAND OFFICE",     key: "L", color: 0x7f8c8d },
  pub:      { x: 800, y: 280, w: 120, h: 80, label: "PUB",             key: "P", color: 0x6c5d4f },
} as const;
