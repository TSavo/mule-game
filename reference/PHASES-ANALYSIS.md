# Planet M.U.L.E. Complete Phase Analysis

Decompiled from Planet M.U.L.E. v1.3.6 (Turborilla). This documents the exact
mechanics, timing, transitions, and formulas for every game phase.

---

## Table of Contents

1. [Phase Enum & Complete Round Sequence](#1-phase-enum--complete-round-sequence)
2. [Game Configuration (GameInfo / GameMode)](#2-game-configuration)
3. [Properties - All Game Constants](#3-properties---all-game-constants)
4. [Intro Phase](#4-intro-phase)
5. [Land Grant Phase](#5-land-grant-phase)
6. [Land Auction Phase](#6-land-auction-phase)
7. [Player Event Phase](#7-player-event-phase)
8. [Colony Event Phase (A - before production)](#8-colony-event-phase-a)
9. [Development Phase](#9-development-phase)
10. [Production Phase](#10-production-phase)
11. [Colony Event Phase (B - after production)](#11-colony-event-phase-b)
12. [Collection Phase](#12-collection-phase)
13. [Auction Phase (Trading)](#13-auction-phase-trading)
14. [Summary Phase](#14-summary-phase)
15. [Wampus Mechanics](#15-wampus-mechanics)
16. [Scoring & Ranking](#16-scoring--ranking)
17. [Spoilage Mechanics](#17-spoilage-mechanics)
18. [Map & Tile Production Values](#18-map--tile-production-values)
19. [Shop & Pricing](#19-shop--pricing)

---

## 1. Phase Enum & Complete Round Sequence

### Phase Enum (exact order from `Phase.java`)

```java
public enum Phase {
    CONNECT,
    RECONNECT,
    GAME_LOBBY,
    INTRO,
    HIRE,
    LAND_GRANT,
    LAND_RUSH,
    LAND_AUCTION,
    PLAYER_EVENT,
    COLONY_EVENT_A,
    DEVELOPMENT,
    FAST_DEVELOPMENT,
    PRODUCTION,
    COLONY_EVENT_B,
    COLLECTION,
    COLLECTION_CRYSTITE,
    COLLECTION_SMITHORE,
    COLLECTION_ENERGY,
    COLLECTION_FOOD,
    AUCTION_CRYSTITE,
    AUCTION_SMITHORE,
    AUCTION_ENERGY,
    AUCTION_FOOD,
    SUMMARY;
}
```

### Phase Registration in GameController

```java
phases.put(Phase.CONNECT, new ConnectPhase());
phases.put(Phase.GAME_LOBBY, new GameLobbyPhase());
phases.put(Phase.INTRO, new IntroPhase());
phases.put(Phase.LAND_GRANT, new LandGrantPhase());
phases.put(Phase.PLAYER_EVENT, new PlayerEventPhase());
phases.put(Phase.COLONY_EVENT_A, new ColonyEventPhase(true));   // categoryA = true
phases.put(Phase.PRODUCTION, new ProductionPhase());
phases.put(Phase.COLONY_EVENT_B, new ColonyEventPhase(false));  // categoryA = false
phases.put(Phase.COLLECTION_CRYSTITE, new CollectionPhase(Resource.Crystite));
phases.put(Phase.COLLECTION_SMITHORE, new CollectionPhase(Resource.Smithore));
phases.put(Phase.COLLECTION_ENERGY, new CollectionPhase(Resource.Energy));
phases.put(Phase.COLLECTION_FOOD, new CollectionPhase(Resource.Food));
phases.put(Phase.AUCTION_CRYSTITE, new AuctionPhase(Resource.Crystite));
phases.put(Phase.AUCTION_SMITHORE, new AuctionPhase(Resource.Smithore));
phases.put(Phase.AUCTION_ENERGY, new AuctionPhase(Resource.Energy));
phases.put(Phase.AUCTION_FOOD, new AuctionPhase(Resource.Food));
phases.put(Phase.LAND_AUCTION, new LandAuctionPhase());
phases.put(Phase.SUMMARY, new SummaryPhase2());
```

### Complete Round Sequence (Per-Round)

Each round follows this exact phase transition chain:

```
INTRO
  -> LAND_GRANT (if singleDevelopment mode)
  -> LAND_RUSH (if multi-development mode, not currently used)
  -> LAND_AUCTION
    -> PLAYER_EVENT (for EACH player, sequentially)
      -> COLONY_EVENT_A (category A events: good for colony)
        -> DEVELOPMENT (single or multi, per player)
          -> PRODUCTION (animated energy + production)
            -> COLONY_EVENT_B (category B events: bad for colony)
              -> COLLECTION_CRYSTITE
                -> COLLECTION_SMITHORE
                  -> COLLECTION_ENERGY
                    -> COLLECTION_FOOD
                      -> AUCTION_CRYSTITE
                        -> AUCTION_SMITHORE
                          -> AUCTION_ENERGY
                            -> AUCTION_FOOD
                              -> SUMMARY
                                -> (next round INTRO, or game over)
```

### Phase Transition Mechanics

Each phase calls `model.setNextPhase(Phase.XXX)` then sends `ReadyMessage`.
When all users are ready, `GameController.update()` calls `model.goToNextPhase()`.

```java
// GameModel
public void goToNextPhase() {
    this.phase = this.nextPhase;
    this.nextPhase = null;
    this.clearUsersReady();
}
```

### Round Numbering

- `firstRound = 0` (Properties constant)
- Rounds are 0-indexed
- `GameInfo.getLastRound()` = `numRounds` (configurable, typically 12)
- `model.beginNextRound()` increments round counter

---

## 2. Game Configuration

### GameMode Enum

```java
public enum GameMode {
    TOURNAMENT("Tournament", "Requires 2 or more human players", maxAI=2),
    TRAINING("Training", "Allows up to 4 computer players", maxAI=4);
}
```

Note: Planet M.U.L.E. only has TOURNAMENT and TRAINING modes (not Beginner/Standard/Tournament
like the original C64 game). The original's difficulty tiers are handled via configurable `numRounds`.

### GameInfo Fields

```java
private GameMode mode;
private boolean singleDevelopment;  // true = one player at a time, false = all at once
private boolean useRiver;           // whether map has river
private boolean useDeserts;         // whether map has desert tiles
private int numRounds;              // getLastRound() returns this
private boolean allowSpectators;
private boolean fastAiDevelopment;  // AI takes fast development turns
private String mapSkinName;
```

---

## 3. Properties - All Game Constants

### Player Starting Resources

```java
playerStartMoney = 1000
playerStartFood = 4
playerStartEnergy = 2
playerStartSmithore = 0
playerStartCrystite = 0
```

### Shop Starting Inventory

```java
shopStartFood = 8
shopStartEnergy = 8
shopStartSmithore = 8
shopStartCrystite = 0
shopStartNumMules = 14
shopMaxBuildMules = 14
maxShopUnits = 32  // cap per resource
```

### Land Grant Timing

```java
landGrantCountdown = 4.0f        // seconds countdown before plot highlight starts
landGrantPlotDuration = 18       // frames per plot highlight (at game tick rate)
landGrantGraceFrames = 6         // grace frames for network lag
landGrantMinGraceDuration = 10   // minimum grace frames
landGrantSendInterval = 4        // how often to send network updates
landGrantOutro = 3.5f            // seconds for outro after all claims
```

### Land Auction Timing

```java
landAuctionTime = 34.25f         // seconds for each auction
landAuctionPrice = 160           // starting price
landAuctionPriceRange = 140      // range around starting price
```

### Development Phase Timing

```java
minDevelopmentTime = 5.0f        // minimum development time (no food)
maxDevelopmentTime = 47.5f       // maximum development time (full food)
developmentCountdown = 4.0f      // countdown timer before development starts
developmentOutro = 3.5f          // outro timer after development ends
outfitMuleTime = 1.0f            // time for MULE outfit animation
```

### Food Requirements (by round index)

```java
foodRequirements = {0, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0}
// Index 0 = round 0 (first round), Index 13 = sentinel
// Round 0: 0 food needed
// Rounds 1-4: 3 food needed
// Rounds 5-8: 4 food needed
// Rounds 9-12: 5 food needed
```

### Production Timing

```java
productionPowerTime = 2.0f        // time for power allocation animation
productionStartProduceTime = 2.6f // time before production ticks start
produceTimeMin = 0.3f             // min time between production ticks
produceTimeMax = 0.5f             // max time between production ticks
productionResultTime = 9.0f       // time for production result display
maxProduction = 8                 // max production per factory per round
```

### Collection Phase Timing

```java
previousUnitsTime = 2.5f     // show previous resource amounts
usageTime = 1.0f             // show usage (consumption) animation
currentUnitsTime = 2.5f      // show current units after usage
spoilageTime = 1.0f          // show spoilage animation
intermediateUnitsTime = 2.5f // show intermediate amounts
collectionTime = 1.0f        // show collection (production added) animation
resultUnitsTime = 4.0f       // show final result
collectionEndTime = 5.0f     // time before moving to next phase
```

### Auction Timing

```java
skipAuctionTime = 4.0f       // time to skip if no goods
noGoodsForSaleTime = 4.0f    // display time when no goods
auctionTime = ?              // (see AbstractAuctionPhase for details)
```

### Pub / Gambling

```java
pubRoundBonus = {25, 25, 25, 50, 50, 50, 50, 75, 75, 75, 75, 100, 100}
// Index = round number. Guaranteed minimum payout.
pubMaxRandomAmount = 100
// Max payout capped at $250
```

### Scoring

```java
pointsPerLand = 500         // points per owned tile
pointsPerMule = 35          // points per installed MULE
```

### Equipment Costs (from Resource enum)

```java
crystiteEquipmentCost  // set in Properties, used by Resource.Crystite
smithoreEquipmentCost  // set in Properties, used by Resource.Smithore
foodEquipmentCost      // set in Properties, used by Resource.Food
energyEquipmentCost    // set in Properties, used by Resource.Energy

// Energy costs per factory type:
foodEnergyRequirement = 1
smithoreEnergyRequirement = 1
crystiteEnergyRequirement = 1
// Energy factories cost 0 energy to run
```

### Lab Items

```java
waterTankFoodBonus     // bonus food from water tank
waterTankSmithoreBonus // bonus smithore from water tank
miningTowerSmithoreBonus // bonus smithore from mining tower
miningTowerEnergyBonus   // bonus energy from mining tower
powerPlantEnergyBonus    // array of bonus energy from power plant
powerPlantFoodBonus      // array of food bonus (negative = penalty) from power plant
depotPrice = 25
depotRound = 1           // round when depot becomes available
depotRank = 1            // rank requirement for depot
powerPlantRound = 1      // round when power plant becomes available
powerPlantRank = 1       // rank requirement
```

### Movement Speeds

```java
landMovingSpeed          // player movement speed on map
hirlingSpeed = 60        // hireling NPC movement speed
defaultRaceSpeed = 80    // default player race speed
```

### Misc

```java
maxNumPlayers = 4
minMoneyStep = 5          // minimum money increment in auctions
firstRound = 0            // starting round index
globalBlinksPerSecond = 0.75f
playerEventChance = 0.275f  // 27.5% chance of player event each turn
matchmakingOutroTime = 2.0f
```

### Map Size

```java
// From GameModel constructor:
this.map = new PlanetMap(9, 5);  // 9 columns x 5 rows = 45 tiles
```

---

## 4. Intro Phase

### IntroPhase.begin()

- If `round == firstRound` (round 0): shows ship entering/landing animation
- If `round > firstRound`: shows ship taking off animation (just transit between rounds)

### Transition Logic

```java
private void goToNextPhase() {
    if (shipIsEntering) {
        model.setNextPhase(Phase.SUMMARY);  // First round: show initial summary
    } else if (Properties.mule.enableHiring) {
        model.setNextPhase(Phase.HIRE);     // Hiring mode
    } else if (model.getGameInfo().isSingleDevelopment()) {
        model.setNextPhase(Phase.LAND_GRANT);  // Standard: go to land grant
    } else {
        model.setNextPhase(Phase.LAND_RUSH);   // Multi-development: land rush
    }
}
```

**IMPORTANT**: On the very first round (round 0, ship entering), INTRO goes to SUMMARY first
(to show initial player lineup), then the normal round sequence begins from round 1.

---

## 5. Land Grant Phase

### Source: `LandGrantPhase.java`, `LandGrant.java`

### Mechanics

The LandGrant model maintains a list of free tiles (scanned left-to-right, top-to-bottom).
Each round, it iterates through the free tiles. For each tile:

1. The cursor highlights the tile for `landGrantPlotDuration` (18) frames
2. During highlight, any player can press their button to claim it
3. Conflict resolution: if multiple players claim simultaneously, the **lowest-ranked player wins**
   (worst score = most favored)
4. After claim (or timeout), the cursor moves to the next free tile

### LandGrant Model

```java
public void begin(PlanetMap planetMap) {
    freeTiles.clear();
    currentTile = -1;
    finished = false;
    // Scan left-to-right, top-to-bottom for unclaimed non-shop tiles
    for (int i = 0; i < planetMap.getYSize(); i++) {
        for (int j = 0; j < planetMap.getXSize(); j++) {
            PlanetTile tile = planetMap.getTile(j, i);
            if (tile.getType() == Shop || tile.getOwner() != null) continue;
            freeTiles.add(tile);
        }
    }
}
```

### Cursor Pattern

The cursor scans through `freeTiles` sequentially (row-by-row, left-to-right). The index
advances by 1 each time via `landGrant.nextTile()`.

### Claiming Mechanics

Each player has a `PlayerStatus` tracking: plot index, frame, pressed state, claimed state.

```java
private boolean checkDone() {
    if (claimer != null || plotDone) return true;
    Player winner = null;
    short lowestFrame = Short.MAX_VALUE;
    short lowestRank = Short.MAX_VALUE;
    for (Player player : model.getPlayers()) {
        PlayerStatus status = playerStatus.get(player);
        if (!status.pressed) continue;
        // Lowest frame first, then lowest rank (highest rank number = worst player)
        if (status.frame < lowestFrame ||
            (status.frame == lowestFrame && player.getRank() > lowestRank)) {
            winner = player;
            lowestFrame = status.frame;
            lowestRank = player.getRank();
        }
    }
    if (winner != null) {
        claimer = winner;
    }
    return claimer != null;
}
```

**Key insight**: Ties in frame are broken by rank -- the player with the HIGHEST rank number
(worst score) wins the tie. This favors trailing players.

### Phase End -> Next Phase

```java
private void goToNextPhase() {
    for (Player player : model.getPlayers()) {
        player.hasClaimedLand = true;
        player.getAvatar().setInShop(true);
        player.getAvatar().setPosition(model.getShop().getStartLocation());
    }
    model.setNextPhase(Phase.LAND_AUCTION);
}
```

After Land Grant, ALL players are placed in the shop and transition to LAND_AUCTION.

---

## 6. Land Auction Phase

### Source: `AbstractLandAuctionPhase.java`, `LandAuctionPhase.java`

### Plot Selection

The land auction sells ONE plot per auction round. The plot is selected from unclaimed tiles.

### Bidding Mechanics

- Auction timer: `landAuctionTime = 34.25` seconds
- Starting price: `landAuctionPrice = 160`
- Price range: `landAuctionPriceRange = 140`
- Players move their avatars up/down in the auction bar to set bid amounts
- Bidding uses the `AuctionState` and `AuctionLimits` system (same as trading auctions)

### Winner Determination

```java
public void finished() {
    ArrayList<Player> winners = new ArrayList<>();
    int highestBid = 0;
    for (Player player : model.getPlayersInRankOrder()) {
        if (!player.getAuctionState().isInAuction()) continue;
        int bid = player.getAuctionState().getPrice(auction.getCurrentLimits());
        if (bid > highestBid) {
            winners.clear();
            winners.add(player);
            highestBid = bid;
        } else if (bid == highestBid) {
            winners.add(player);
        }
    }
    int winnerNumber = 0;
    if (winners.size() > 0) {
        if (model.getRound() == 1) {
            // Round 1: random tiebreaker
            winnerNumber = winners.get(random.nextInt(winners.size())).getUserNumber();
        } else {
            // Other rounds: last in rank order wins (worst-ranked player)
            winnerNumber = winners.get(winners.size() - 1).getUserNumber();
        }
    }
}
```

**Tie-breaking**: In round 1, ties are broken randomly. In all other rounds, the worst-ranked
player (last in `playersInRankOrder`) wins the tie. This again favors trailing players.

### Transition

After land auction completes:
- Next phase depends on development mode (PLAYER_EVENT or directly to development)

---

## 7. Player Event Phase

### Source: `PlayerEventPhase.java`, `PlayerEvent.java`, `PlayerEventGenerator.java`

### When Events Fire

Player events fire BEFORE development, AFTER land auction. Each player in rank order
gets checked for a random event.

### Event Probability

```java
playerEventChance = 0.275f  // 27.5% chance per player per round
```

### Target Player Selection

```java
// GameModel.nextPlayerForEvent()
public Player nextPlayerForEvent() {
    if (round > gameInfo.getLastRound() - 2) {
        // Last 2 rounds: always target the worst-ranked player
        return playersInRankOrder.get(playersInRankOrder.size() - 1);
    }
    if (random.nextFloat() < 0.5f) {
        // 50% chance: target the best-ranked player (rank 1)
        return playersInRankOrder.get(0);
    }
    // 50% chance: target the worst-ranked player
    return playersInRankOrder.get(playersInRankOrder.size() - 1);
}
```

**Critical detail**: The first-place player CANNOT get good events. Good events only go to
non-first-place players. The `condition()` on each event checks player eligibility.

### Amount Scaling

```java
// PlayerEventGenerator.apply()
public String apply(PlayerEvent event, Player player, GameModel model) {
    int amount = 25 * (model.getRound() / 4 + 1);
    // Round 0-3: amount = 25
    // Round 4-7: amount = 50
    // Round 8-11: amount = 75
    // Round 12: amount = 100
    return event.action(player, model, amount);
}
```

### Complete Event List

#### GOOD Events (only for non-first-place players):

| Event Class | Description | Effect |
|---|---|---|
| HomeWorldPackage | Package from home-world relatives | +3 Food, +2 Energy |
| WanderingSpaceTraveler | Space traveler leaves smithore | +2 Smithore |
| BestBuiltMule | MULE judged best built at colony fair | +money (amount varies) |
| TapDancingMule | MULE won tap-dancing contest | +money |
| AgricultureAward | Colony council agriculture award | +2*amount per food plot |
| WormInfestation | Stopped wart worm infestation | +4*amount |
| MuseumBoughtComputer | Museum bought antique computer | +money |
| SwampEelEating | Won swamp eel eating contest | +money |
| Charity | Home-world charity took pity | +money |
| ArtificialDumbness | Offworld investments in artificial dumbness | +money |
| RelativeDied | Distant relative died, left fortune (after taxes) | +money |
| DeadMooseRat | Found dead moose rat, sold hide | +money |

#### BAD Events (target any player, first-place more likely):

| Event Class | Description | Effect |
|---|---|---|
| CatBugAteRoof | Cat-bugs ate roof off house | -money for repairs |
| MuleRanAway | MULE ran away (requires owned MULE) | Lose a MULE |
| Pestilence | Pestilence strikes plots | Halve food production |
| Radiation | Radiation leak | Resource loss |
| FireInBuilding | Fire in building | Lose building/factory |
| AcidRainStorm | (player-level) | Resource damage |
| MeteoriteStrike | (player-level) | Land damage |

### Event Sequence

Events are pre-generated and shuffled at game start. Each round consumes events from
the shuffled list. Once an event fires for a player, it's marked as used (most events
fire only once per game).

---

## 8. Colony Event Phase (A)

### Source: `ColonyEventPhase.java`, `ColonyEvent.java`, `ColonyEventGenerator.java`

Colony Event A fires AFTER player events, BEFORE development. It handles "category A"
events (generally good for the colony or specific effects).

### Colony Event Types

```java
public enum Type {
    PEST_ATTACK(categoryA=false, "Planetary Pest", "Eats all Food at one Plot"),
    PIRATE_SHIP(categoryA=false, "Space Pirates", "Steal all the Colony's Crystite"),
    ACID_RAIN_STORM(categoryA=true, "Acid Rain", "Increases Food but decreases Energy production"),
    PLANET_QUAKE(categoryA=false, "Planetquake", "Halves all production of Crystite and Smithore"),
    SUNSPOT_ACTIVITY(categoryA=true, "Sunspot Activity", "Increases all Energy production"),
    METEORITE_STRIKE(categoryA=true, "Meteorite Strike", "Enriches a Plot with Crystite"),
    RADIATION(categoryA=true, "Radiation", "Causes a M.U.L.E. to Go Crazy"),
    FIRE_IN_STORE(categoryA=false, "Fire in Store", "The whole Stock is Burned"),
    SHIP_RETURNS(categoryA=false, "Return of the Colonial Ship", "");
}
```

- **Category A** (before production): ACID_RAIN_STORM, SUNSPOT_ACTIVITY, METEORITE_STRIKE, RADIATION
- **Category B** (after production): PEST_ATTACK, PIRATE_SHIP, PLANET_QUAKE, FIRE_IN_STORE, SHIP_RETURNS

### Event Generation Algorithm

```java
public void generate(GameModel model) {
    ArrayList<Type> pool = new ArrayList<>(20);
    add(pool, PIRATE_SHIP, 2);       // 2 copies
    add(pool, ACID_RAIN_STORM, 3);   // 3 copies
    add(pool, SUNSPOT_ACTIVITY, 3);  // 3 copies
    add(pool, FIRE_IN_STORE, 2);     // 2 copies
    shuffle(pool, model.getRandom());
    shuffle(pool, model.getRandom());  // Double shuffle!

    events = new ArrayList<>(20);
    events.add(null);  // Round 0: no colony event

    // First 2 events from shuffled pool
    int earlyCount = 2;
    for (int i = 0; i < earlyCount; i++) {
        events.add(pool.get(i));
    }

    // Remaining events shuffled with additional types
    ArrayList<Type> laterPool = new ArrayList<>();
    // ... adds remaining pool items + additional types
    // Then fills remaining rounds
}
```

**Key**: Round 0 has NO colony event (null). Events are pre-generated for all rounds at game start.

### Colony Event A Phase Transition

```java
// ColonyEventPhase constructed with categoryA flag:
// Phase.COLONY_EVENT_A = new ColonyEventPhase(true)
// Phase.COLONY_EVENT_B = new ColonyEventPhase(false)
```

After COLONY_EVENT_A -> DEVELOPMENT

---

## 9. Development Phase

### Source: `AbstractDevelopmentPhase.java`, `DevelopmentPhaseSingle.java`,
`DevelopmentPhaseMulti.java`, `FastDevelopmentPhase.java`, `Development.java`

### Turn Order

Development uses `playersInRankOrder` (sorted by score). The order depends on
MULE availability in the shop:

```java
// Development.setPlayerOrder()
public void setPlayerOrder() {
    int numMules = model.getShop().numMules();
    if (numMules <= 7) {
        // Reverse order: worst player goes first (most turns left)
        playerIndex = players.size();  // starts past end, decrements
        order = -1;
    } else {
        // Normal order: best player goes first
        playerIndex = -1;  // starts before beginning, increments
        order = 1;
    }
}
```

**Key insight**: When MULEs are scarce (7 or fewer in shop), turn order REVERSES so the
worst-ranked player goes first (getting first pick of MULEs).

### Development Time Calculation

```java
// Player.useFood()
public void useFood(int round) {
    int required = Properties.mule.foodRequirements[round];
    // Mechtron race: 0 food needed
    if (enableHiring && avatar.getRace().equals("mechtron")) {
        required = 0;
    }

    if (required > food) {
        foodUsage = food;  // use all available
        float fraction = (float)foodUsage / (float)required;
        float maxTime = Properties.mule.maxDevelopmentTime;  // 47.5
        float minTime = Properties.mule.minDevelopmentTime;  // 5.0
        developmentTime = fraction * maxTime + (1.0f - fraction) * minTime;
    } else {
        foodUsage = required;
        developmentTime = Properties.mule.maxDevelopmentTime;  // 47.5
    }
    food -= foodUsage;
}
```

**Formula**: `devTime = (foodUsed/foodRequired) * 47.5 + (1 - foodUsed/foodRequired) * 5.0`
- Full food: 47.5 seconds
- No food: 5.0 seconds
- Partial food: linear interpolation between 5.0 and 47.5

### Development Actions Available

During a player's development turn, they can:

1. **Buy a MULE** - Enter the corral in town, buy for `shop.getMuleCost()` (price rises with smithore)
2. **Outfit a MULE** - Walk to a resource store (food/energy/smithore/crystite) to equip
3. **Place a MULE** - Walk to an owned tile and press action button to install
4. **Sell Land** - Toggle sell mode, walk to owned tile to sell it
5. **Visit the Pub** - Enter the pub for gambling payout
6. **Visit the Assay Office** - Buy assay to reveal crystite on a tile
7. **Buy Lab Items** - Mining Tower, Water Tank, Power Plant, Depot
8. **Catch the Wampus** - If Wampus appears on a mountain, walk to it

### Pub (Gambling) Formula

```java
// GameModel.gamble()
public int gamble(Player player, float timeLeft, boolean notify) {
    if (timeLeft < 0.0f) timeLeft = 0.0f;
    float maxTime = Properties.mule.maxDevelopmentTime;  // 47.5
    float fraction = Math.min(timeLeft / maxTime, 1.0f);
    int payout = Properties.mule.pubRoundBonus[round];
    payout += (int)(random.nextFloat() * fraction * pubMaxRandomAmount);

    // Flapper race: double gambling bonus
    if (enableHiring && player.getRace().equals("flapper")) {
        payout *= 2;
    }

    payout = Math.min(payout, 250);  // Hard cap at $250
    player.setMoney(player.getMoney() + payout);
    player.setGambled(true);
    return payout;
}
```

**Pub Payout Formula**:
```
payout = pubRoundBonus[round] + random(0..1) * (timeLeft/47.5) * 100
payout = min(payout, 250)
```

- `pubRoundBonus`: [25, 25, 25, 50, 50, 50, 50, 75, 75, 75, 75, 100, 100]
- Going to pub EARLY (more time left) = higher potential payout
- Going to pub LATE = only get the round bonus minimum
- Hard cap: $250

### Countdown & Outro

```java
developmentCountdown = 4.0f  // seconds before development starts
developmentOutro = 3.5f      // seconds after timer expires
```

### Phase Transition

After all players complete development, next phase is PRODUCTION.

---

## 10. Production Phase

### Source: `ProductionPhase.java`

### Sequence

1. **Power Phase** (`productionPowerTime = 2.0` seconds)
   - Visual: energy allocation animation
   - After timer: `finishPower()` -- calls `player.useEnergy()` for all players

2. **Production Tick Phase** (`productionStartProduceTime = 2.6` seconds initial delay)
   - Factories produce one unit at a time
   - Each tick: random interval between `produceTimeMin=0.3` and `produceTimeMax=0.5` seconds
   - Factories shuffled randomly each tick
   - Each tick increments production by 1 until `production == capacity`
   - When all factories reach capacity: production finished

3. **Result Display** (`productionResultTime = 9.0` seconds)
   - Shows final production amounts
   - Then transitions to COLONY_EVENT_B

### Energy Consumption (Player.useEnergy)

```java
public void useEnergy(Random random) {
    energyUsage = 0;
    ArrayList<PlanetTile> tiles = new ArrayList<>(ownedTiles);
    Collections.shuffle(tiles, random);  // RANDOM order!
    for (PlanetTile tile : tiles) {
        for (Building building : tile.getBuildings()) {
            int power = Math.min(energy, building.getEnergyNeeded());
            building.setPower(power);
            energy -= power;
            energyUsage += power;
            if (building instanceof Factory) {
                Factory factory = (Factory) building;
                factory.calcCapacity(random);
            }
        }
    }
}
```

**Key**: Energy is allocated in RANDOM tile order. If a player doesn't have enough energy,
some factories will get power and others won't -- determined randomly each round.

### Factory Production Calculation

```java
// Factory.calcCapacity()
public void calcCapacity(Random random) {
    int variation = Math.round(MuleMath.normalDistributed(random));
    capacity = yieldPotential + bonus + temporaryBonus + variation;
    expectedProduction = capacity - variation;
    capacity = calcCapacity(capacity);     // clamp and power check
    expectedProduction = calcCapacity(expectedProduction);
    temporaryBonus = 0;
}

private int calcCapacity(int n) {
    if (power < energyNeeded) {
        n = (power == 0) ? 0 : (capacity > 1 ? n / 2 : 1);
    }
    return MuleMath.clamp(n, 0, maxProduction);  // clamp to [0, 8]
}
```

**Production Formula**:
```
capacity = yieldPotential + adjacencyBonus + temporaryBonus + normalRandom()
if (partialPower) capacity /= 2
if (noPower) capacity = 0
capacity = clamp(capacity, 0, 8)
```

### Adjacency Bonuses

Calculated by `Building.calcBonuses()`. Adjacent factories of the same resource type
get +1 bonus each (economies of scale from the original game).

### Transition

After production animation: `model.setNextPhase(Phase.COLONY_EVENT_B)`

---

## 11. Colony Event Phase (B)

Fires AFTER production, BEFORE collection. Handles "category B" events (generally bad
for the colony):

- PEST_ATTACK: Eats all food at one plot
- PIRATE_SHIP: Steals all colony's crystite
- PLANET_QUAKE: Halves crystite and smithore production
- FIRE_IN_STORE: Burns entire store stock

After COLONY_EVENT_B -> COLLECTION_CRYSTITE

---

## 12. Collection Phase

### Source: `CollectionPhase.java`, `CollectionPainter.java`

Collection runs 4 times per round, once per resource in this order:
1. COLLECTION_CRYSTITE
2. COLLECTION_SMITHORE
3. COLLECTION_ENERGY
4. COLLECTION_FOOD

### Animated Bar Display Sequence

For each resource, the collection display goes through these timed stages:

```
1. PREVIOUS UNITS (2.5s)    - Show starting resource amounts (before production)
     Title: "<Resource> for Round X"

2. USAGE (1.0s)             - Animate bars down to show consumption
     Title: "Usage" or "No Usage"
     Bars shrink from (resource + usage) down to (resource)

3. CURRENT UNITS (2.5s)     - Show amounts after usage subtracted
     Title: "Spoilage" or "No Spoilage" (or "Production"/"No Production" if no spoilage)

4. SPOILAGE (1.0s)          - Animate bars down to show spoilage
     Bars shrink by spoilage amount

5. INTERMEDIATE UNITS (2.5s) - Show amounts after spoilage
     Title: "Production" or "No Production"

6. COLLECTION (1.0s)        - Animate bars UP to show production added
     Bars grow by production amount

7. RESULT UNITS (4.0s)      - Show final resource amounts

8. END (5.0s)               - Pause before next phase
```

### Collection State Machine

```java
// CollectionPhase.update() - simplified:
if (previousUnitsTimer > 0) {
    previousUnitsTimer -= delta;
    // When done: set title to "Usage"/"No Usage"
} else if (!usageFinished) {
    if (usageTimer > 0) {
        usageTimer -= delta;
        // When done: animate bars to current resources (minus usage)
    } else if (!barsStillAnimating) {
        // Apply usage to actual player data
        usageFinished = true;
    }
} else if (currentUnitsTimer > 0) {
    currentUnitsTimer -= delta;
    // When done: set title to "Spoilage"/"No Spoilage" or "Production"
} else if (!spoilageFinished) {
    if (spoilageTimer > 0) {
        spoilageTimer -= delta;
        // When done: animate bars down for spoilage
    } else if (!barsStillAnimating) {
        spoilageFinished = true;
    }
} else if (intermediateUnitsTimer > 0) {
    intermediateUnitsTimer -= delta;
    // When done: set title to "Production"/"No Production"
} else if (!collectionFinished) {
    if (collectionTimer > 0) {
        collectionTimer -= delta;
        // When done: animate bars UP for production
    } else if (!barsStillAnimating) {
        collectionFinished = true;
    }
} else if (resultUnitsTimer > 0) {
    resultUnitsTimer -= delta;
} else {
    // Phase complete, go to next
}
```

### Bar Animation Speed

```java
// ResourceBar
private static final float UNIT_SIZE = 6.0f;  // pixels per unit
private static final float SPEED = 25.0f;     // pixels per second

// Bar height = units * 6.0f
// Animation speed: 25 pixels/second = ~4.17 units/second
```

### Phase Transition Chain

```
COLLECTION_CRYSTITE -> COLLECTION_SMITHORE -> COLLECTION_ENERGY -> COLLECTION_FOOD
    -> AUCTION_CRYSTITE
```

---

## 13. Auction Phase (Trading)

### Source: `AuctionPhase.java`, `AbstractAuctionPhase.java`, `AuctionController.java`

Already documented in previous decompilation. Key points:

- Runs 4 times: Crystite, Smithore, Energy, Food
- Buyers move up, sellers move down
- Store has buy/sell prices (spread)
- Time limit per auction
- Prices determined by supply/demand (Shop.calcBuySellPrice)

### Auction Order

```
AUCTION_CRYSTITE -> AUCTION_SMITHORE -> AUCTION_ENERGY -> AUCTION_FOOD -> SUMMARY
```

---

## 14. Summary Phase

### Source: `SummaryPhase2.java`, `SummaryPainter3.java`

### Sequence

1. Update player rank order (`model.updatePlayerRankOrder()`)
2. Calculate points for all players
3. Shop builds MULEs (replenishes from smithore)
4. Calculate colony total
5. Check shortage message
6. Animate players walking to positions (sorted by rank)
7. Display score table: Money | Land | Goods | Total
8. Show colony rating message

### Colony Rating

```java
private String getColonyMessage() {
    int lastRound = model.getGameInfo().getLastRound();
    int threshold = 20000 * lastRound / 12;
    int rating = MuleMath.clamp(colonyTotal / threshold, 0, colonyMessages.length - 1);
    return colonyMessages[rating];
}
```

Colony rating = `colonyTotal / (20000 * lastRound / 12)`, clamped to message array index.

The `colonyMessages` array contains rating strings from worst to best (like the original
game's colony rating system).

### Shortage Check

The game checks if the colony has a critical shortage of any resource. If neither
players nor the store have food or energy, the game can end immediately with colony failure.

### MULE Building (Shop)

```java
// Shop.buildMules() - called at summary
// Uses smithore in the store to build new MULEs
// 2 smithore per MULE, up to shopMaxBuildMules (14)
```

### Game Over Check

```java
if (model.isGameOver()) {
    controller.gameEnded();
    // Save scores
} else {
    // Wait for all players to continue
    // Then: model.beginNextRound() -> next round INTRO
}
```

### Score Display Layout

```
| Player | Money | Plots | Assets | Total |
|--------|-------|-------|--------|-------|
```

- Money: current cash
- Plots: number of owned tiles
- Assets: `landPoints + goodsPoints` (500*tiles + MULE values + resource market values)
- Total: `money + landPoints + goodsPoints`

### Player Walking Animation

Players walk from right side of screen to lineup positions, sorted by rank.
Speed: 120 pixels/second. Winner gets cheering animation (jumping).

---

## 15. Wampus Mechanics

### Source: `Wampus.java`

### Spawn Logic

The Wampus lives on mountain tiles. At game start, all Mountain2 and Mountain3 tiles
are catalogued as potential Wampus locations.

```java
public Wampus(PlanetMap map, Random random, int round) {
    // Collect all mountain tiles
    for (int y = 0; y < map.getYSize(); y++) {
        for (int x = 0; x < map.getXSize(); x++) {
            PlanetTileType type = map.getTile(x, y).getType();
            if (type == Mountain2 || type == Mountain3) {
                // Add mountain sub-tiles to list
            }
        }
    }
    appeared = false;
    visible = false;
    dead = mountains.isEmpty();

    // Initial blink timer (delay before first appearance)
    blinkTimer = easyToCatchWampus ? 0.0f : 12.0f + 3.0f * random.nextFloat();
    // Normal: 12-15 second delay. Easy mode: immediate.

    moneyReward = 100 * ((round + 4) / 4);
    // Round 0-3: $100, Round 4-7: $200, Round 8-11: $300, Round 12: $400
}
```

### Bounty by Round

```
Rounds 0-3:  $100
Rounds 4-7:  $200
Rounds 8-11: $300
Round 12:    $400
```

Formula: `100 * ((round + 4) / 4)` using integer division.

### Blink Pattern

```java
public void update(long frame, SoundPlayer sound) {
    if (dead) return;
    blinkTimer -= delta;
    if (blinkTimer <= 0) {
        if (visible) {
            // Was visible, now hide. Wait before next appearance.
            blinkTimer += easyToCatch ? 0.2f : 4.25f;
        } else {
            // Was hidden, now show on a new mountain
            if (numBlinks == 0) {
                randomMountain();  // pick new mountain
                numBlinks = 2;     // will blink twice at this location
            }
            blinkTimer += easyToCatch ? 3.45f : 0.75f;
            numBlinks--;
        }
        visible = !visible;
        appeared = true;
        if (visible && sound != null) {
            sound.playWampusAppeared(pos.y);  // Sound pitch varies with Y position
        }
    }
}
```

**Normal difficulty pattern**:
- Initial delay: 12-15 seconds
- Visible for: 0.75 seconds (very brief!)
- Hidden between blinks: 4.25 seconds
- Appears twice at each mountain location, then moves to a new random mountain
- Sound plays when appearing (pitch based on Y position = vertical location hint)

### Catch Mechanics

```java
public boolean canBeCaughtAt(float x, float y) {
    if (!appeared || dead) return false;
    float distance = pos.distance(x, y);
    return distance < 5.0f;  // Must be within 5 pixels
}
```

Player must walk to within 5 pixels of the Wampus position. The Wampus is only catchable
while visible (0.75 seconds per blink). Each human player can catch the Wampus once per round.

### Mountain Removal

When a player claims a tile with mountains, those mountains are removed from the Wampus's
mountain list. If no mountains remain, the Wampus dies.

---

## 16. Scoring & Ranking

### Score Calculation (Player.calcPoints)

```java
public void calcPoints(Shop shop) {
    landPoints = 0;
    goodsPoints = 0;
    for (PlanetTile tile : ownedTiles) {
        landPoints += Properties.mule.pointsPerLand;  // +500 per tile
        Factory factory = tile.getFactory();
        if (factory != null) {
            goodsPoints += Properties.mule.pointsPerMule;  // +35 per MULE
            goodsPoints += factory.getResource().equipmentCost;  // +equipment cost
        }
    }
    goodsPoints += food * shop.getPrice(Resource.Food);
    goodsPoints += energy * shop.getPrice(Resource.Energy);
    goodsPoints += smithore * shop.getPrice(Resource.Smithore);
    goodsPoints += crystite * shop.getPrice(Resource.Crystite);
    points = money + landPoints + goodsPoints;
}
```

**Score = Money + LandPoints + GoodsPoints**

Where:
- LandPoints = 500 * number of owned tiles
- GoodsPoints = (35 + equipmentCost) per installed MULE + market value of all resources
- Market value uses CURRENT shop prices (so resource prices affect scores)

### Rank Order

```java
// GameModel.updatePlayerRankOrder()
// First round with debugRandomStartRank: shuffle randomly
// Otherwise: sort by OrderByPoints (ascending = worst first)
Collections.sort(playersInRankOrder, new Player.OrderByPoints());
// Then assign ranks: rank 1 = best, rank N = worst
for (int i = 0; i < playersInRankOrder.size(); i++) {
    playersInRankOrder.get(i).setRank(i + 1);
}
```

Rank 1 = highest score (best player). Higher rank number = worse score.

---

## 17. Spoilage Mechanics

### Player.calcSpoilage()

```java
public int calcSpoilage(Resource resource) {
    if (hasDepot()) return 0;  // Depot prevents ALL spoilage!

    switch (resource) {
        case Food:     return food / 2;           // Lose half of food
        case Energy:   return energy / 4;          // Lose quarter of energy
        case Crystite: return crystite > 50 ? crystite - 50 : 0;  // Keep max 50
        case Smithore: return smithore > 50 ? smithore - 50 : 0;  // Keep max 50
    }
}
```

**Spoilage Rules** (applied during Collection phase):
- **Food**: Lose 50% (integer division)
- **Energy**: Lose 25% (integer division)
- **Crystite**: Anything over 50 is lost
- **Smithore**: Anything over 50 is lost
- **Depot**: Completely prevents all spoilage

---

## 18. Map & Tile Production Values

### Map Layout

```java
new PlanetMap(9, 5);  // 9 columns x 5 rows = 45 tiles
```

Center tile (column 4) is the Town/Shop tile.

### Tile Types & Yield Potentials

```java
public enum PlanetTileType {
    Shop("shop", food=0, energy=0, smithore=0),
    Plain("plain", food=plainFood, energy=plainEnergy, smithore=plainSmithore),
    SmallWater("small water", food=smallWaterFood, energy=smallWaterEnergy, smithore=smallWaterSmithore),
    Water("water", food=waterFood, energy=waterEnergy, smithore=waterSmithore),
    Desert("desert", food=desertFood, energy=desertEnergy, smithore=desertSmithore),
    Mountain1("mountain-1", food=mountain1Food, energy=mountain1Energy, smithore=mountain1Smithore),
    Mountain2("mountain-2", food=mountain2Food, energy=mountain2Energy, smithore=mountain2Smithore),
    Mountain3("mountain-3", food=mountain3Food, energy=mountain3Energy, smithore=mountain3Smithore),
}
```

The actual yield values come from Properties constants (plainFood, plainEnergy, etc.).
These are the base `yieldPotential` values used in production calculations.

**Crystite** is separate -- it's hidden until assayed, and values are set per-tile during
map generation (random distribution).

### River Tiles

River tiles (Water, SmallWater) have high food potential but low smithore.
The river runs through the middle row of the map.

---

## 19. Shop & Pricing

### Initial Prices

```java
shopFoodInitialPrice      // from Properties
shopEnergyInitialPrice    // from Properties
shopSmithoreInitialPrice  // from Properties
shopCrystiteInitialPrice  // from Properties
shopMuleInitialPrice      // from Properties
```

### Price Calculation (Supply & Demand)

Each resource has a `ResourcePrices` object tracking: `price`, `buyPrice`, `sellPrice`.

```java
// Shop.calcBuySellPrice() - called before each auction
// Food: based on total supply vs. demand (players * foodRequirements[nextRound])
// Energy: based on total supply vs. total energy requirements
// Smithore: based on mules available + smithore/2 vs. tiles needing MULEs
// Crystite: random price deviation (crystite is speculative)
```

The buy/sell spread creates a market where:
- **Buy price** (player buying from store) > base price
- **Sell price** (player selling to store) < base price
- Spread varies by supply/demand ratio

### MULE Price

MULE price is tied to smithore prices and availability. When smithore is scarce,
MULE prices increase.

```java
// Shop.buildMules() - builds MULEs from smithore at end of each round
// 2 smithore per MULE
// Up to shopMaxBuildMules (14) total in shop
```

---

## Appendix: Key Class Files

All decompiled Java source files are in `/home/tsavo/mule-game/reference/decompiled/`:

### Phase Controllers
- `PhaseController.java` - Abstract base for all phases
- `GameController.java` - Master controller, phase transitions
- `IntroPhase.java` - Ship animation, round transitions
- `LandGrantPhase.java` - Cursor-based land claiming
- `AbstractLandAuctionPhase.java` - Land auction base
- `LandAuctionPhase.java` - Land auction implementation
- `PlayerEventPhase.java` - Random player events
- `ColonyEventPhase.java` - Colony-wide events
- `AbstractDevelopmentPhase.java` - Development base (town, map, MULE, pub)
- `DevelopmentPhaseSingle.java` - Single-player development turns
- `DevelopmentPhaseMulti.java` - Simultaneous development
- `FastDevelopmentPhase.java` - Accelerated AI development
- `ProductionPhase.java` - Energy allocation + production ticks
- `CollectionPhase.java` - Resource collection with bar animations
- `AuctionPhase.java` - Trading auctions (already decompiled)
- `AbstractAuctionPhase.java` - Auction base (already decompiled)
- `SummaryPhase2.java` - End-of-round scoring display

### Models
- `GameModel.java` - Central game state
- `GameInfo.java` - Game configuration
- `GameMode.java` - Tournament/Training enum
- `Properties.java` - All game constants
- `Player.java` - Player state, resources, scoring (already decompiled)
- `Shop.java` - Store inventory, pricing, MULE building
- `Resource.java` - Resource enum with equipment costs
- `Development.java` - Development turn order logic
- `LandGrant.java` - Land grant tile sequence
- `LandRush.java` - Land rush mechanics
- `Wampus.java` - Wampus spawn, blink, catch, bounty
- `PlayerEvent.java` - All player event types
- `PlayerEventGenerator.java` - Event probability and selection
- `ColonyEvent.java` - All colony event types
- `ColonyEventGenerator.java` - Colony event scheduling
- `Auction.java` - Auction model (already decompiled)
- `AuctionState.java` - Auction state (already decompiled)
- `AuctionLimits.java` - Auction limits (already decompiled)

### Map
- `AbstractMap.java` - Base map class (9x5 grid)
- `PlanetMap.java` - Game map with tile access
- `PlanetTile.java` - Tile types, yield potentials, buildings
- `Tile.java` - Base tile class
- `PlanetMapGenerator.java` - Map generation algorithm
- `Factory.java` - Production building (calcCapacity, calcProduction)
- `Building.java` - Base building class (adjacency bonuses)
- `Depot.java` - Depot building (prevents spoilage)

### View
- `CollectionPainter.java` - Collection bar animation
- `SummaryPainter3.java` - Summary screen rendering
- `LandGrantPainter.java` - Land grant cursor rendering
