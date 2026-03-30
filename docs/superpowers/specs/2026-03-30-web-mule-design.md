# Web M.U.L.E. — Game Design Spec

Spiritual successor to M.U.L.E. (1983, Danielle Bunten Berry) for the web browser. Faithful to the core economic loop with modernized UX. Retro pixel art aesthetic.

## Tech Stack

- **Frontend**: Phaser 3 (2D pixel art game engine)
- **Backend**: Colyseus (real-time multiplayer game server)
- **Shared**: TypeScript monorepo
- **Priority**: Speed of development

### Monorepo Structure

```
packages/
  shared/     — Game types, constants, economic formulas, map generation, deterministic RNG
  server/     — Colyseus game server (rooms, state sync, AI players, economy engine)
  client/     — Phaser 3 client (rendering, input, UI, scenes)
```

## Players

- 0-4 human players, AI fills remaining slots to always have 4 players
- Real-time online multiplayer with lobbies/matchmaking
- AI is critical — solo play against 3 AI opponents must be a complete experience

## Game Structure

12 rounds. Each round has phases in this order:

1. **Land Grant** — Cursor scans 5x9 grid. First player to claim gets a free plot. One per player per round.
2. **Land Auction** — 0-6 unclaimed plots offered sequentially (avg 1). Players bid in real-time. If a plot doesn't sell, auction ends — no further plots offered.
3. **Development** — Each player gets a timed turn. Duration determined by food supply. Run to town, buy a M.U.L.E., outfit it, install on your plot. Or hunt the Wampus. Or visit the pub to cash out remaining time.
4. **Production** — Automated. Each installed M.U.L.E. produces based on terrain quality, energy supply, adjacency bonuses, and random events. Max 8 units per M.U.L.E.
5. **Random Event** — One event per round. Good or bad. Rubber-banding: bad events target the leader, good events target trailing players.
6. **Trading Auction** — For each resource (Smithore → Crystite → Food → Energy): declaration phase, then real-time buyer/seller price negotiation. The signature mechanic.
7. **Summary/Scoring** — Update player rankings (land + goods + money). Display standings.

Colony death: if NO player AND the store have zero food or energy at end of any round, all players lose.

Final scoring after round 12. Highest total value wins. Colony score (sum of all players) determines if you're "First Founder" or sent home to work in a M.U.L.E. factory.

## Map

### Grid

5 rows x 9 columns = 45 tiles. Center tile (row 3, col 5) is the **town** (not claimable). 44 playable plots.

### Terrain Types

- **River** — Center column (col 5), excluding town. 4 river tiles. Best for food. No mining allowed (no smithore, no crystite).
- **Mountains** — Varying sizes (small hills to peaked mountains). Size indicates smithore quality visually. ~6-8 mountain tiles scattered randomly. Best for smithore. Poor for energy. Wampus habitat.
- **Plains** — Everything else. Best for energy. Decent for food. Poor for smithore.

### Production Quality by Terrain

| Resource | River | Plains | Mountains (small) | Mountains (large) |
|----------|-------|--------|-------------------|-------------------|
| Food | **High** | Medium | Poor | Poor |
| Energy | Poor | **High** | **Poor** | **Poor** |
| Smithore | **None** | Poor | Medium-Good | **High** |
| Crystite | **None** | Hidden/Varies | Hidden/Varies | Hidden/Varies |

Quality displayed as 0-4 dots beneath resource symbol after development phase.

### Crystite Deposits

- Hidden at game start. Tournament mode only.
- Placed in clusters (3-5 tiles of varying productivity: no/low/medium/high).
- Clusters tend to group together (original clustering algorithm).
- Revealed per-tile via assay office (free but costs development time).
- Other players can observe where you assay and deduce findings.
- River tiles cannot have crystite. Deposits can generate under the town (wasted).

### Map Generation Algorithm

1. Place town at center (row 3, col 5)
2. River fills column 5 (excluding town) — 4 river tiles
3. Scatter 6-8 mountain tiles randomly across non-river tiles (varying sizes)
4. Everything else = plains
5. Generate 1-2 crystite clusters (3-5 tiles each) with productivity levels
6. Seeded deterministic RNG — server and client agree on all random outcomes

## Core Economic System

Everything is connected. This is the game.

### Resources

- **Food** — Determines development turn duration. Insufficient food = shorter turn = less time to buy/outfit/place M.U.L.E.s. Required amount scales up as game progresses.
- **Energy** — Required for production. Each installed M.U.L.E. consumes energy. Shortage = reduced or zero output.
- **Smithore** — Store uses smithore to manufacture M.U.L.E.s. If nobody mines smithore, M.U.L.E. supply drops and price rises. This is the critical supply chain loop.
- **Crystite** — Pure luxury export. Sold to store only (off-world). Random pricing ($50-150, avg $100), not supply/demand. Pirates can steal all crystite in the game. Tournament mode only.

### The Supply Chain Loop

Smithore → Store manufactures M.U.L.E.s → Players buy M.U.L.E.s → Install on plots → Produce resources → Trade in auction. If smithore dries up, no new M.U.L.E.s, everyone stalls.

### Store Mechanics

- Unlimited money, finite goods
- Starting inventory: **16 food, 16 energy, 0 smithore**
- Buys at low prices (floor), sells at high prices (ceiling)
- Acts as buyer/seller of last resort in auctions — but only if it has stock
- If store has zero of a resource, there is NO floor/ceiling — players set all prices
- M.U.L.E. availability directly tied to smithore in the store
- M.U.L.E. base price rises with scarcity
- Store keeps all goods it buys, resells at exorbitant markup next round
- Price of resources determined by total supply/demand across all players + store

### Production Formula (4 factors)

1. **Tile quality** — Terrain type match (river/plains/mountains vs resource type)
2. **Energy availability** — Shortage reduces or eliminates output
3. **Adjacency bonus** — Same resource on neighboring tiles increases production. Scaling bonuses at 3/6/9+ tiles of same type. Incentivizes contiguous territory.
4. **Random events** — Can boost or devastate production

Max 8 units per M.U.L.E. per round.

### Spoilage

Between rounds: 50% of food surplus can spoil, 25% of energy surplus can spoil. Smithore/crystite units exceeding 50 are spoiled.

## Town (Development Phase)

During development, players navigate the town interior. Buildings:

- **M.U.L.E. Corral** — Buy a M.U.L.E. at current price (tied to smithore supply/demand). Must outfit before leaving town.
- **Food Outfitter** — $25 to outfit M.U.L.E. for food production
- **Energy Outfitter** — $50 to outfit for energy
- **Smithore Outfitter** — $75 to outfit for smithore mining
- **Crystite Outfitter** — $100 to outfit for crystite mining
- **Assay Office** — Enter without a M.U.L.E. Walk to any plot center, press action, return to office. Reports crystite level: "no"/"low"/"medium"/"high". Free but costs development time. Visible to other players.
- **Land Office** — Enter without a M.U.L.E. Walk to your plot, press action. That plot gets auctioned off next round.
- **Pub** — Ends your turn immediately. Payout scales with remaining time on the clock. Strategic: done installing M.U.L.E.s? Cash out.

### Wampus

- Native creature living in mountain caves
- Appears on random mountain tiles during development, only when player has no M.U.L.E. in tow
- Brief appearance (few seconds), signaled by sound (indicates Y-position)
- Catching it awards cash: $100 (rounds 1-3), $200 (rounds 4-7), $300 (rounds 8-11), $400 (round 12)
- One catch per player per round

### M.U.L.E. Behavior

M.U.L.E.s can be stubborn — they may refuse to work or run away if not installed properly. Player must walk M.U.L.E. to plot center and press action. Missing the center = beep, try again.

## Trading Auction (Signature Mechanic)

Runs once per round for each resource in order: **Smithore → Crystite → Food → Energy**. Skipped if nobody has the resource ("no sellers, no auction").

### Pre-Auction: Production Summary

Before each resource auction, animated bars show:
1. Previous inventory
2. Minus consumption (food/energy used)
3. Minus spoilage
4. Plus new production
5. Minimum line showing required amount — above = surplus, below = shortage

### Declaration Phase (timed)

- Each player declares **buyer** or **seller** (push up or down)
- Auto-jumps to appropriate side based on surplus/shortage, but can override
- Can flip back and forth until declare timer runs out
- Strategic mindgames: faking intent, reading opponents

### The Auction

- Sellers start at **top** (high asking price), buyers at **bottom** (low bid)
- All players move **simultaneously** in real-time
- Sellers move **down** to lower price. Buyers move **up** to raise bid.
- **Dashed lines** show highest bid and lowest ask among all players
- Store buy price (floor) and sell price (ceiling) shown as horizontal lines — **only if store has stock**
- Buyers can buy from store by walking to store's sell price line
- Players can sell to store at its buy price

### Trading

- When buy line meets sell line → both players **flash**
- Trading begins **one unit at a time**
- Buyer's money decreases, seller's money increases, units traded counter updates
- Either party can break the deal by moving away
- Trading continues until seller runs out of surplus, buyer runs out of money, or someone walks away
- Timer per resource auction

## AI Players

### Difficulty Tiers

- **Beginner** — Suboptimal choices. Claims mediocre land, doesn't time auctions well, doesn't manipulate supply chains.
- **Standard** — Competent play. Good land selection, reasonable auction behavior, basic resource strategy.
- **Tournament** — Plays to win. Manipulates smithore supply, times auction declarations strategically, reads market state, corners resources when profitable.

### Decision Points

1. **Land Grant** — Evaluate tile quality by terrain type + adjacency to owned plots + crystite potential. Higher difficulty = better evaluation.
2. **Development** — Choose resource to outfit based on inventory, market prices, other players' production, store needs.
3. **Auction Declaration** — Decide buyer/seller. Higher AI may fake declarations.
4. **Auction Pricing** — How aggressively to move. Reads desperation (shortage levels visible from production summary). Exploits monopoly positions.
5. **Long-term Strategy** — Tournament AI plans multi-round: corner smithore early, stockpile crystite, create artificial shortages.

### Implementation

- AI acts through the exact same interface as human players — sends identical inputs to server
- Decision logic runs server-side with configurable delay (feels natural, not instant)
- Each AI has a personality seed biasing strategy (one prefers food, another smithore) for variety

## Architecture

### Server (Colyseus)

- **GameRoom** — One room per game session. Manages round state machine.
- **GameState** — Authoritative state: map grid, player inventories, store inventory, M.U.L.E. placements, round/phase tracking. Synced to all clients via Colyseus schema.
- **EconomyEngine** — All economic calculations server-side: production, price curves, spoilage, M.U.L.E. manufacturing, store pricing. No trust on client.
- **AIPlayer** — Pluggable AI using same input interface as humans. Difficulty levels affect decision quality.
- **LobbyRoom** — Matchmaking, game creation, 0-4 human players + AI fill.

### Client (Phaser 3)

- **MapScene** — 5x9 tile grid rendering, M.U.L.E. placement, land grant cursor animation
- **TownScene** — Interior view during development (corral, shops, assay, land office, pub)
- **AuctionScene** — Trading auction with buyer/seller walk mechanic, price lines, real-time movement
- **HUDOverlay** — Player money, resources, round info, timer, production dots
- **LobbyScene** — Game browser, create/join, player count selection

### Shared Package

- TypeScript types for all game entities
- Map generation (terrain distribution, crystite cluster placement)
- Economic constants and formulas (production tables, price curves, spoilage rates, adjacency bonuses)
- Deterministic seeded RNG

### State Flow

All game logic runs on the server. Client sends inputs (claim plot, buy M.U.L.E., move player, set auction price). Server validates, updates state, broadcasts. Client renders from synced state. No client-side game logic — pure rendering.

## Game Modes

- **Beginner** — Simplified rules (no crystite, shorter game)
- **Standard** — 12 rounds, full rules, land auctions
- **Tournament** — 12 rounds, crystite enabled, computer players get $200 extra starting cash

## Player Species

8 character types with different visual sprites and starting bonuses. In the original, species affected starting money (e.g., Humanoid starts with more money but is "easier" to play; others like Mechtron or Gollumer start with less). For v1: implement species as cosmetic-only with identical starting conditions. Species stat differences are a future enhancement once core balance is proven.

## v1 Scope

### In

- 5x9 grid, classic map generation
- All 4 resources (food, energy, smithore, crystite)
- Full economic loop (production, spoilage, store, supply chain)
- Trading auction with declaration phase
- Land grant + land auction
- Town with all buildings (corral, outfitters, assay, land office, pub)
- Wampus hunting
- Random events with rubber-banding
- AI players (3 difficulty tiers)
- Real-time online multiplayer (0-4 humans, AI fill)
- Lobbies/matchmaking
- Retro pixel art
- Adjacency production bonuses
- All 3 game modes (beginner/standard/tournament)

### Out (future)

- Multiple map templates/sizes
- Spectator mode
- Ranked play / leaderboards
- Direct player-to-player trading outside auction
- Custom game rules/house rules
- Mobile touch controls
- Replay system
