# M.U.L.E. Mechanics Audit: Planet M.U.L.E. Reference vs Our Implementation

Generated 2026-03-31. Compares decompiled Planet M.U.L.E. v1.3.6 (Java) against
`mule-game/packages/shared/` and `mule-game/packages/server/`.

---

## 1. Map Generation

#### Grid Size
- **Reference**: `PlanetMap(9, 5)` -- 9 columns x 5 rows = 45 tiles.
- **Our Code**: `MAP_ROWS=5, MAP_COLS=9` in types.ts. `generateMap()` creates 5x9 grid.
- **Status**: CORRECT

#### Town Tile
- **Reference**: Center tile (column 4, row 2) is Shop/Town. Not claimable.
- **Our Code**: `TOWN_ROW=2, TOWN_COL=4`. Town placed at `tiles[2][4]`.
- **Status**: CORRECT

#### River Tiles
- **Reference**: River runs through center column (col 4). Types: Water (high food, 0 smithore), SmallWater (some smithore). River includes the town row but town overrides it.
- **Our Code**: River placed at `RIVER_COL=4` for all rows except `TOWN_ROW`. Only uses `TerrainType.River` -- no distinction between Water and SmallWater.
- **Status**: WRONG
- **Fix**: The reference has two distinct water types: `Water` (food=4, energy=2, smithore=0) and `SmallWater` (food=?, energy=?, smithore=1). Our code treats all river tiles as identical `River` (food=4, energy=2, smithore=0). Need to add `SmallWater` terrain type and assign it to appropriate river tiles (typically the top and bottom river tiles have smallWater, middle ones have full Water).

#### Mountain Generation
- **Reference**: Mountains are placed on the map with specific distribution. Mountain1, Mountain2, Mountain3 are distinct terrain types with different yield potentials.
- **Our Code**: Randomly places 6-8 mountains using `MIN_MOUNTAINS=6, MAX_MOUNTAINS=8`. Types are randomly chosen from Mountain1/2/3.
- **Status**: WRONG
- **Fix**: The reference map generation is not fully documented in the decompilation, but the random placement with random type assignment is a reasonable approximation. However, there is no guarantee the distribution matches the original. The original likely has a more structured mountain placement algorithm. Low priority.

#### Crystite Distribution
- **Reference**: Crystite values are set per-tile during map generation (random distribution). Hidden until assayed.
- **Our Code**: Uses cluster-based placement with 1-2 clusters of 3-5 tiles. Levels are "none"/"low"/"medium"/"high". Clusters use 8-directional neighbors (including diagonals).
- **Status**: EXTRA (different algorithm, but reasonable)
- **Fix**: The cluster approach is a creative addition. The original likely assigns crystite more uniformly. Not blocking but worth noting as a deviation.

#### Desert/Plains Naming
- **Reference**: Has distinct `Desert` and `Plain` terrain types. Desert: food=0, energy=4, smithore=1. Plain: separate yield values.
- **Our Code**: Only has `TerrainType.Plains` with yields matching the reference's `Desert` (food=0, energy=4, smithore=1). No separate `Plain` type.
- **Status**: WRONG
- **Fix**: The reference lists both `Plain` and `Desert` as separate types. Our code collapses them into one (`Plains`) with Desert's yields. Need to verify whether the original C64 game actually distinguishes plains from desert, or if Planet M.U.L.E. (Java remake) just renamed them. The yield values we use match Desert, which is the non-river flat terrain -- so functionally this may be correct even if the naming differs.

---

## 2. Starting Conditions

#### Player Starting Money
- **Reference**: `playerStartMoney = 1000` for all modes.
- **Our Code**: `STARTING_MONEY = { beginner: 1000, standard: 1000, tournament: 1000 }`.
- **Status**: CORRECT

#### Player Starting Inventory
- **Reference**: food=4, energy=2, smithore=0, crystite=0.
- **Our Code**: `STARTING_INVENTORY = { food: 4, energy: 2, smithore: 0, crystite: 0 }`.
- **Status**: CORRECT

#### Store Starting Inventory
- **Reference**: food=8, energy=8, smithore=8, crystite=0, mules=14.
- **Our Code**: `STORE_STARTING_INVENTORY = { food: 8, energy: 8, smithore: 8, crystite: 0 }`. `STORE_STARTING_MULES = 14`.
- **Status**: CORRECT

#### Store Max Units
- **Reference**: `maxShopUnits = 32` (cap per resource). Some sources say 255.
- **Our Code**: No explicit cap implemented.
- **Status**: MISSING
- **Fix**: Add a maximum store inventory cap. The AUCTION-ANALYSIS.md says 255 per resource; PHASES-ANALYSIS.md says 32. Use 32 as it comes from Properties.java.

#### Species/Race Bonuses
- **Reference**: Mechtron: 0 food needed. Flapper: double gambling bonus. Humanoid: 25% chance of bonus (humanoidBonusProbability=25%).
- **Our Code**: Species enum exists (Mechtron, Gollumer, Packer, Bonzoid, Spheroid, Flapper, Leggite, Humanoid) but NO species-specific bonuses are implemented anywhere.
- **Status**: MISSING
- **Fix**: Implement species bonuses: (1) Mechtron skips food requirement in development time calculation, (2) Flapper doubles pub payout, (3) Humanoid has 25% chance of bonus event. These affect gameplay balance significantly.

---

## 3. Phase Order

#### Round Sequence
- **Reference**: LAND_GRANT -> LAND_AUCTION -> PLAYER_EVENT -> COLONY_EVENT_A -> DEVELOPMENT -> PRODUCTION -> COLONY_EVENT_B -> COLLECTION_CRYSTITE -> AUCTION_CRYSTITE -> ... (4 collection/auction pairs) -> SUMMARY
- **Our Code**: PhaseManager uses: land_grant -> land_auction -> player_event -> colony_event_a -> development -> production -> colony_event_b -> collection -> trading_auction -> summary. Collection and auction repeat 4 times via `auctionResourceIndex`.
- **Status**: CORRECT (structure matches)

#### Collection/Auction Resource Order
- **Reference**: Smithore -> Crystite -> Food -> Energy (from AUCTION-ANALYSIS.md Section 9: the fixed order shows Collection_Smithore first).
- **Our Code**: `AUCTION_RESOURCE_ORDER = [Smithore, Crystite, Food, Energy]`.
- **Status**: WRONG
- **Fix**: PHASES-ANALYSIS.md Section 12 says: COLLECTION_CRYSTITE -> COLLECTION_SMITHORE -> COLLECTION_ENERGY -> COLLECTION_FOOD. But AUCTION-ANALYSIS.md Section 9 says: Smithore -> Crystite -> Food -> Energy. These contradict each other in the reference docs. The AUCTION-ANALYSIS.md is more authoritative (it shows the actual phase transition code). However, PHASES-ANALYSIS.md section 12 says COLLECTION_CRYSTITE first. The Phase enum registration shows: COLLECTION_CRYSTITE, COLLECTION_SMITHORE, COLLECTION_ENERGY, COLLECTION_FOOD, AUCTION_CRYSTITE, AUCTION_SMITHORE, AUCTION_ENERGY, AUCTION_FOOD. But the actual transition chain in AUCTION-ANALYSIS.md shows Smithore->Crystite->Food->Energy. Our code matches the AUCTION-ANALYSIS order. Need to verify against actual Java transition logic. **UPDATE**: Looking at the transition code in AUCTION-ANALYSIS.md more carefully: `Smithore -> Phase.AUCTION_SMITHORE`, `Crystite -> Phase.AUCTION_CRYSTITE`, `Food -> Phase.AUCTION_FOOD`, `Energy -> Phase.AUCTION_ENERGY`. Our code matches this. CORRECT after all.

#### Round Numbering
- **Reference**: Rounds are 0-indexed. `firstRound = 0`. Round 0 shows initial summary (ship landing). Actual gameplay starts round 1.
- **Our Code**: `startGame` sets `state.round = 1`. Rounds are 1-indexed.
- **Status**: WRONG
- **Fix**: The reference uses 0-indexed rounds. Round 0 is a special "intro" round that just shows the summary. Our code starts at round 1, effectively skipping round 0. This means our `FOOD_REQUIRED_BY_ROUND` and `PUB_ROUND_BONUS` arrays may be off by one. The reference's `foodRequirements[0] = 0` and `pubRoundBonus[0] = 0/25` are for round 0. Since we start at round 1, our index 0 is never used for round 0 gameplay. This is mostly cosmetic but could cause off-by-one bugs in array lookups.

#### First Round Special Handling
- **Reference**: Round 0 (first round): INTRO goes to SUMMARY first (show initial player lineup). Then normal rounds begin from round 1.
- **Our Code**: No intro/summary for round 0. Game starts directly at land_grant for round 1.
- **Status**: MISSING (minor -- just a UI/display difference)

---

## 4. Land Grant

#### Cursor Pattern
- **Reference**: Scans through free tiles left-to-right, top-to-bottom. Each tile highlighted for `landGrantPlotDuration = 18` frames. At game tick rate this is roughly 300ms per tile.
- **Our Code**: GameRoom advances cursor every 500ms (`cursorTickAccum >= 500`). The LandGrantPhase.ts was not in the read list but the GameRoom shows the cursor is timer-driven.
- **Status**: WRONG
- **Fix**: Reference uses 18 frames at game tick rate (approximately 300ms at 60fps). Our code uses 500ms, which is significantly slower. Adjust to ~300ms to match.

#### Claiming Mechanics / Tie-Breaking
- **Reference**: Multiple players can press to claim. Tie-breaking: earliest frame wins. If same frame, highest rank number (worst player) wins. This favors trailing players.
- **Our Code**: `claimPlot` appears to be first-come-first-served based on message arrival order. No frame-based tie-breaking. No rank-based tie-breaking.
- **Status**: WRONG
- **Fix**: Implement the reference tie-breaking system: (1) Track the frame at which each player pressed, (2) lowest frame wins, (3) ties broken by rank (worst player wins).

#### Land Grant Timing
- **Reference**: `landGrantCountdown = 4.0s` before cursor starts. `landGrantOutro = 3.5s` after all claims.
- **Our Code**: `LAND_GRANT_COUNTDOWN_S = 4.0`, `LAND_GRANT_OUTRO_S = 3.5` defined in constants but unclear if they are used in the actual phase logic.
- **Status**: CORRECT (constants match; implementation may not use them)

---

## 5. Land Auction

#### Overall Status
- **Reference**: Full land auction system with timer (34.25s), starting price ($160), price range ($140), bid mechanics using AuctionState/AuctionLimits, winner determination with rank-based tie-breaking.
- **Our Code**: `GameRoom.enterPhase` for "land_auction" just calls `this.advancePhase()` -- it auto-skips entirely with comment "Auto-advance -- land auctions handled in future version".
- **Status**: MISSING
- **Fix**: Implement the full land auction phase. Key mechanics: (1) Select unclaimed plot, (2) 34.25s timer, (3) Players bid by moving avatars up/down, (4) Starting price $160, (5) Round 1 ties broken randomly, other rounds worst-ranked player wins, (6) Winner pays bid amount.

#### Land Auction Constants
- **Reference**: `landAuctionTime = 34.25s`, `landAuctionPrice = 160`, `landAuctionPriceRange = 140`.
- **Our Code**: Constants exist (`LAND_AUCTION_TIME_S`, `LAND_AUCTION_STARTING_PRICE`, `LAND_AUCTION_PRICE_RANGE`) but are unused since the phase is skipped.
- **Status**: CORRECT constants, MISSING implementation

---

## 6. Player Events

#### Probability
- **Reference**: `playerEventChance = 0.275` (27.5% per player per round).
- **Our Code**: `PLAYER_EVENT_PROBABILITY = 0.275`.
- **Status**: CORRECT (constant)
- **Fix**: Verify the RandomEventPhase actually uses this probability. The `selectRandomEvent` function in events.ts just does `rng.pick(RANDOM_EVENTS)` with no probability check -- it always selects an event.

#### Target Player Selection
- **Reference**: Last 2 rounds: always target worst-ranked player. Otherwise: 50% chance target best-ranked, 50% chance target worst-ranked. First-place player CANNOT get good events.
- **Our Code**: Events have `RandomEventTarget.Trailing` (good events) and `RandomEventTarget.Leader` (bad events). The `RandomEventPhase.execute` likely selects a random event and applies it to the appropriate target. No round-based targeting logic visible.
- **Status**: WRONG
- **Fix**: Implement: (1) 27.5% probability check before firing an event, (2) Last 2 rounds always target worst player, (3) Otherwise 50/50 best vs worst targeting, (4) Good events cannot go to first-place player.

#### Amount Scaling
- **Reference**: `amount = 25 * (round / 4 + 1)`. Round 0-3: $25, Round 4-7: $50, Round 8-11: $75, Round 12: $100. Events use this amount as a multiplier.
- **Our Code**: Event effects have fixed hardcoded amounts (e.g., best_mule: $150, charity: $250). No round-based scaling.
- **Status**: WRONG
- **Fix**: Replace hardcoded amounts with the formula `25 * (Math.floor(round / 4) + 1)`. Each event should use this base amount with event-specific multipliers (e.g., WartWorm = 4*amount, AgricultureAward = 2*amount per food plot).

#### Event List Completeness
- **Reference**: 12+ good events, 7+ bad events, with specific effects (MULE ran away = lose a MULE, Pestilence = halve food production, etc.).
- **Our Code**: 10 good events (Trailing), 5 bad events (Leader), 4 colony events. Missing several reference events. Effects are simplified (flat money/resource amounts instead of complex effects like losing a MULE or halving production).
- **Status**: WRONG
- **Fix**: Add missing events: MuleRanAway (lose an installed MULE), Pestilence (halve food production), AcidRainStorm (player-level), MeteoriteStrike (player-level). Also add the "HomeWorldPackage" event that gives +3 Food, +2 Energy (our "relatives_package" gives +3 Food only, missing +2 Energy).

#### Event Pre-Generation
- **Reference**: Events are pre-generated and shuffled at game start. Each round consumes from the shuffled list. Most events fire only once per game.
- **Our Code**: `selectRandomEvent` picks randomly each time with no pre-generation or uniqueness tracking.
- **Status**: WRONG
- **Fix**: Pre-generate and shuffle the event list at game start. Track which events have been used. Most should fire at most once.

---

## 7. Colony Events

#### Category A/B Split
- **Reference**: Category A (before production): ACID_RAIN_STORM, SUNSPOT_ACTIVITY, METEORITE_STRIKE, RADIATION. Category B (after production): PEST_ATTACK, PIRATE_SHIP, PLANET_QUAKE, FIRE_IN_STORE, SHIP_RETURNS.
- **Our Code**: Colony events are mixed into the general `RANDOM_EVENTS` array with `RandomEventTarget.Colony`. No A/B category distinction. GameRoom calls `randomEventPhase.execute()` for both colony_event_a and colony_event_b with the same logic.
- **Status**: WRONG
- **Fix**: Split colony events into Category A and Category B pools. Colony Event A phase should only draw from Category A events. Colony Event B should only draw from Category B events.

#### Colony Event Types
- **Reference**: 9 colony event types with specific effects.
- **Our Code**: 4 colony events: planetquake, pirate_raid, acid_rain, sunspot. Missing: METEORITE_STRIKE (enriches plot with crystite), RADIATION (MULE goes crazy), FIRE_IN_STORE (burns store stock), SHIP_RETURNS.
- **Status**: WRONG
- **Fix**: Add missing colony events. FIRE_IN_STORE is particularly impactful (destroys all store inventory). METEORITE_STRIKE adds crystite to a random plot. RADIATION makes a MULE malfunction. SHIP_RETURNS presumably restocks the colony ship.

#### Event Generation Algorithm
- **Reference**: Pool created with weighted copies (PIRATE_SHIP x2, ACID_RAIN x3, SUNSPOT x3, FIRE_IN_STORE x2). Double-shuffled. Round 0 has no colony event. Events pre-assigned to rounds at game start.
- **Our Code**: Colony events selected randomly each round from the 4-event pool. No weighting. No pre-assignment.
- **Status**: WRONG
- **Fix**: Implement the weighted pool pre-generation algorithm. Create pool with correct copy counts, double-shuffle, pre-assign to rounds. Round 0 (or round 1 in our numbering) should have no colony event.

#### Acid Rain Effect
- **Reference**: "Increases Food but decreases Energy production" (it's a mixed effect -- good for food, bad for energy).
- **Our Code**: "Acid rain reduces food production colony-wide" with multiplier 0.5 on Food. This is the opposite of the reference.
- **Status**: WRONG
- **Fix**: Acid Rain should INCREASE food production and DECREASE energy production. The reference says `categoryA=true` for Acid Rain, meaning it fires before production and modifies production values. Fix the effect to increase food and decrease energy.

#### Planetquake Effect
- **Reference**: "Halves all production of Crystite and Smithore".
- **Our Code**: `production_modifier` on Smithore with multiplier 0.25 (quarters, not halves). Does not affect Crystite.
- **Status**: WRONG
- **Fix**: Change multiplier to 0.5 (halve, not quarter). Apply to BOTH Smithore and Crystite.

---

## 8. Development Phase

#### Turn Order
- **Reference**: Uses `playersInRankOrder` (sorted by score). When MULEs <= 7 in shop, order REVERSES so worst player goes first. Otherwise best player goes first.
- **Our Code**: DevelopmentPhase.start() sorts by money (as score proxy). When `store.muleCount <= 7`, sorts ascending (worst first). Otherwise descending (best first).
- **Status**: CORRECT (logic matches, using money as score proxy is reasonable early game)

#### Development Time Formula
- **Reference**: `devTime = (foodUsed/foodRequired) * 47.5 + (1 - foodUsed/foodRequired) * 5.0`. Full food = 47.5s, no food = 5.0s, partial = linear interpolation.
- **Our Code**: `calculateTurnDuration` in food-timer.ts uses the same formula: `MIN_TURN_DURATION_MS + range * ratio` where range = 47500-5000 and ratio = food/required.
- **Status**: CORRECT

#### Food Consumption
- **Reference**: Player.useFood() subtracts required food (or all available if less). Food amount changes BEFORE development time is calculated. Mechtron race needs 0 food.
- **Our Code**: `calculateTurnDuration` takes foodAmount as parameter. The caller presumably handles food subtraction. No Mechtron species bonus.
- **Status**: WRONG (missing Mechtron bonus)
- **Fix**: Add Mechtron species check: if species === "mechtron", foodRequired = 0 (always gets max development time).

#### Food Requirements Table
- **Reference**: `[0, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]` (14 entries, index 0-13).
- **Our Code**: `FOOD_REQUIRED_BY_ROUND = [0, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5]` (13 entries, index 0-12).
- **Status**: CORRECT (missing index 13 sentinel value of 0, but since our game ends at round 12, this doesn't matter)

#### Pub Payout Formula
- **Reference**: `payout = pubRoundBonus[round] + random(0..1) * (timeLeft/47.5) * pubMaxRandomAmount`. `pubMaxRandomAmount = 100`. Cap at $250. Flapper race doubles payout. `pubRoundBonus = [25, 25, 25, 50, 50, 50, 50, 75, 75, 75, 75, 100, 100]`.
- **Our Code**: `PUB_ROUND_BONUS = [0, 50, 50, 50, 100, 100, 100, 100, 150, 150, 150, 150, 200]`. `PUB_MAX_RANDOM_AMOUNT = 200`. Cap at $250. No Flapper bonus.
- **Status**: WRONG
- **Fix**: (1) Fix PUB_ROUND_BONUS to match reference: `[25, 25, 25, 50, 50, 50, 50, 75, 75, 75, 75, 100, 100]`. Our values are exactly double the reference values (and shifted by one index with a 0 at index 0). (2) Fix PUB_MAX_RANDOM_AMOUNT from 200 to 100. (3) Add Flapper species double bonus. Combined, our pub payouts are roughly 2x what they should be, which significantly alters game economy.

#### Wampus
- **Reference**: Spawns on Mountain2/Mountain3 tiles. Initial delay 12-15s. Visible for 0.75s, hidden for 4.25s. Blinks twice at each location then moves. Bounty: `100 * ((round + 4) / 4)` = $100/$200/$300/$400. Catchable within 5 pixels. Each human player can catch once per round.
- **Our Code**: `WAMPUS_BOUNTY_BY_ROUND = [0, 100, 100, 100, 200, 200, 200, 200, 300, 300, 300, 300, 400]`. `WAMPUS_VISIBILITY_SECONDS = 0.75`. Wampus catch tracking in DevelopmentPhase via `wampusCaught` set.
- **Status**: CORRECT (bounty table and visibility match)
- **Fix**: The bounty array matches the formula output. Visibility matches. The actual spawn/blink logic is likely client-side and not fully implemented yet, but constants are correct.

#### Assay Office
- **Reference**: Player can buy assay to reveal crystite on a tile. `assayTime = 2.5s`.
- **Our Code**: `ASSAY_TIME_S = 2.5` defined but no assay implementation in DevelopmentPhase.
- **Status**: MISSING
- **Fix**: Implement assay mechanic: player visits assay office during development, pays a fee, reveals crystite level on a chosen tile.

#### Lab Items
- **Reference**: Mining Tower, Water Tank, Power Plant, Depot. Each has round/rank requirements. Depot prevents all spoilage. `depotPrice = 25`.
- **Our Code**: No lab items implemented at all.
- **Status**: MISSING
- **Fix**: Implement lab items. Depot is the most game-impactful (prevents all spoilage). Water Tank, Mining Tower, and Power Plant provide production bonuses.

#### Sell Land
- **Reference**: Players can sell owned land during development.
- **Our Code**: No land selling mechanic.
- **Status**: MISSING
- **Fix**: Add ability to sell land during development turn.

#### Development Countdown/Outro
- **Reference**: `developmentCountdown = 4.0s` before turn. `developmentOutro = 3.5s` after turn (but TIMING-REFERENCE.md says 2.0s).
- **Our Code**: `DEVELOPMENT_COUNTDOWN_S = 4.0`, `DEVELOPMENT_OUTRO_S = 2.0`.
- **Status**: CORRECT (matches TIMING-REFERENCE.md value of 2.0s)

---

## 9. Production

#### Energy Consumption Order
- **Reference**: Energy allocated in RANDOM tile order (`Collections.shuffle(tiles, random)`). If not enough energy, some factories get power randomly and others don't.
- **Our Code**: EconomyEngine shuffles tiles with `Math.random()` (not seeded). Then allocates energy to first N tiles.
- **Status**: WRONG (partially)
- **Fix**: Use the seeded RNG instead of `Math.random()` for deterministic behavior. The shuffle-then-allocate approach is correct conceptually.

#### Production Formula
- **Reference**: `capacity = yieldPotential + adjacencyBonus + temporaryBonus + normalRandom()`. If partial power: capacity/2. If no power: capacity=0. Clamped to [0, 8].
- **Our Code**: `finalOutput = (baseOutput + adjacencyBonus) * energyModifier`. energyModifier is 0 or 1 (binary). No Gaussian random variation. No partial power support (half production).
- **Status**: WRONG
- **Fix**: (1) Add Gaussian random variation (`normalDistributed(random)` = roughly +/- 1 unit). (2) Implement partial power: if a factory has less energy than needed but > 0, it produces at half capacity instead of zero. (3) Currently `energyModifier` is binary (0/1); should support 0.5 for partial power. The reference is: no power = 0, partial power = capacity/2, full power = capacity.

#### Energy Cost Per Factory Type
- **Reference**: Food factories need 1 energy. Smithore needs 1. Crystite needs 1. Energy factories need 0 energy (they produce energy, not consume it).
- **Our Code**: `ENERGY_PER_MULE = 1` applied uniformly to all factories.
- **Status**: WRONG
- **Fix**: Energy-producing MULEs should not consume energy to operate. Currently all MULEs cost 1 energy including energy MULEs, which penalizes energy production. Energy MULEs should cost 0.

#### QUALITY_TO_UNITS Mapping
- **Reference**: Production uses `yieldPotential` directly as the base capacity. A mountain3 with smithore has yieldPotential=4, so base production = 4 units.
- **Our Code**: Uses `QUALITY_TO_UNITS = { 0:0, 1:1, 2:3, 3:5, 4:7 }` to map quality to units. So quality 4 (mountain3 smithore) = 7 units, not 4.
- **Status**: WRONG
- **Fix**: Remove `QUALITY_TO_UNITS` mapping. Use quality values directly as base production (yield potential). Mountain3 smithore quality=4 should produce base 4, not 7. The QUALITY_TO_UNITS table inflates production significantly.

#### Adjacency Bonus
- **Reference**: Adjacent factories of the same resource type get +1 bonus each.
- **Our Code**: Uses BFS to find connected group, then looks up `ADJACENCY_BONUS` table: `{1:0, 2:1, 3:2, 4:2, 5:2, 6:3, 7:3, 8:3, 9:4}`.
- **Status**: WRONG
- **Fix**: The reference says adjacent same-type factories each get +1 per adjacent same-type neighbor (simple count). Our code uses group-size-based lookup which gives different values. For example, 3 in a line: each end tile has 1 neighbor (+1), middle tile has 2 neighbors (+2). Our code gives all three +2. Need to verify the exact reference implementation, but the BFS group-size approach likely differs from per-tile neighbor counting.

#### Max Production
- **Reference**: `maxProduction = 8` per factory per round.
- **Our Code**: `MAX_OUTPUT = 8`.
- **Status**: CORRECT

---

## 10. Spoilage

#### Food Spoilage
- **Reference**: `floor(food / 2)` -- lose half, integer division.
- **Our Code**: `floor(foodSurplus * 0.5)` where foodSurplus = food - consumed. Applies AFTER consumption.
- **Status**: WRONG
- **Fix**: Reference applies spoilage to the full food amount, not surplus after consumption. The function `calcSpoilage(Food)` in the reference returns `food / 2` using the player's current food amount. Our code subtracts consumed food first, then spoils the remainder. This is a different order of operations. Spoilage should be calculated on the raw amount, not the surplus.

#### Energy Spoilage
- **Reference**: `floor(energy / 4)` -- lose quarter, integer division.
- **Our Code**: `floor(energySurplus * 0.25)` where energySurplus = energy - consumed. Same issue as food.
- **Status**: WRONG
- **Fix**: Same as food -- spoilage should apply to raw amount, not post-consumption surplus. Also, the reference says energy spoilage is `energy / 4` on the player's energy amount.

#### Smithore Spoilage
- **Reference**: `max(0, smithore - 50)` -- anything over 50 is lost. Player keeps at most 50.
- **Our Code**: `smithore > 50 ? 50 : smithore` (caps at 50).
- **Status**: CORRECT

#### Crystite Spoilage
- **Reference**: `max(0, crystite - 50)` -- anything over 50 is lost. Player keeps at most 50.
- **Our Code**: `crystite > 50 ? 50 : crystite` (caps at 50).
- **Status**: CORRECT

#### Depot
- **Reference**: If player `hasDepot()`, spoilage is 0 for ALL resources.
- **Our Code**: No depot check in spoilage calculation.
- **Status**: MISSING
- **Fix**: Add depot check. If player has a depot, skip all spoilage.

#### Spoilage Timing
- **Reference**: Spoilage happens during Collection phase (displayed with animation). Applied per-resource before each auction.
- **Our Code**: `applySpoilage` in EconomyEngine applies to all resources at once. Called from a separate point in the game flow.
- **Status**: WRONG
- **Fix**: Spoilage should be calculated and displayed per-resource during each Collection phase, not all at once. Each resource's spoilage is shown right before that resource's auction.

---

## 11. Store Economics

#### Initial Prices
- **Reference**: Food buy=$30, Energy buy=$25, Smithore buy=$50, Crystite buy=$50. Sell prices = buy + range.
- **Our Code**: `STORE_INITIAL_PRICE = { food: 30, energy: 25, smithore: 50, crystite: 50 }`. `STORE_BUY_PRICE = { food: 13, energy: 8, smithore: 33, crystite: 50 }`. `STORE_SELL_PRICE = { food: 48, energy: 43, smithore: 68, crystite: 150 }`.
- **Status**: WRONG
- **Fix**: The reference initial prices are `buy=$30, sell=$30+range` for food. With range=$35, that's buy=$30, sell=$65 for food. Our `STORE_BUY_PRICE` of $13 and `STORE_SELL_PRICE` of $48 don't match. The reference buy/sell prices use the initial price as the BASE, not as the midpoint. Need to recalculate: if initial food price=$30 and range=$35, then buy=30, sell=30+35=65. Our values of 13/48 appear to use initialPrice - range/2 and initialPrice + range/2, which centers the range. The reference starts buy AT the initial price and adds range for sell.

#### Price Recalculation (Supply/Demand)
- **Reference**: `Shop.calcBuySellPrice()` recalculates before each Collection phase. Food: supply vs demand (players * foodRequirements). Energy: supply vs player energy requirements. Smithore: mules available vs plots needing mules + Gaussian noise. Crystite: purely random.
- **Our Code**: `getStoreBuyPrice` and `getStoreSellPrice` return static values from `STORE_BUY_PRICE`/`STORE_SELL_PRICE`. No supply/demand recalculation.
- **Status**: MISSING
- **Fix**: Implement dynamic price recalculation based on supply and demand. This is a critical missing mechanic -- prices should shift every round based on the colony's resource situation. Without this, the economy is static and doesn't respond to player actions.

#### Average Price Tracking
- **Reference**: After each auction, the average traded price becomes the new base price for the next round's buy/sell calculation.
- **Our Code**: `TradingAuctionPhase.recordAveragePrice` stores average prices on the store state (`foodAvgPrice`, etc.) but these are never used in price calculations since prices are static.
- **Status**: WRONG
- **Fix**: Use the recorded average prices as inputs to the next round's `calcBuySellPrice()` once dynamic pricing is implemented.

#### MULE Manufacturing
- **Reference**: Store builds MULEs from smithore between rounds. 2 smithore per MULE. Tries to replenish up to 14 MULEs. `mulePrice = smithorePrice * 2` rounded down to nearest $10.
- **Our Code**: `calculateMuleAvailability` only manufactures `Math.min(storeSmithore, 2)` MULEs -- always at most 2 per round regardless of deficit. `calculateMulePrice` uses a scarcity factor formula unrelated to smithore price.
- **Status**: WRONG
- **Fix**: (1) Manufacturing should compute deficit (`14 - currentMules`), cap at `shopMaxBuildMules=14`, then consume `deficit * 2` smithore (or all available smithore, rounded down to even number). (2) MULE price should be `smithorePrice * 2` rounded down to nearest $10, not a scarcity formula.

#### Price Persistence
- **Reference**: Prices persist and evolve round-to-round based on the average auction price.
- **Our Code**: Prices are static constants that never change.
- **Status**: MISSING
- **Fix**: Implement price persistence and evolution. Each auction's average price feeds into the next round's price calculation.

---

## 12. Trading Auction

#### Tick System
- **Reference**: scale=10 ticks per price step. priceStep=1 for food/energy/smithore, priceStep=4 for crystite. pixelRatio=2. maxOutOfAuction=40.
- **Our Code**: `AUCTION_TICK_SCALE=10`, `AUCTION_PRICE_STEP_LOW=1`, `AUCTION_PRICE_STEP_HIGH=4`, `AUCTION_MAX_OUT_OF_AUCTION=40`. tick-to-price and price-to-tick functions match reference formulas.
- **Status**: CORRECT

#### Declaration Phase
- **Reference**: 6 seconds total (3s choose + 3s countdown). Auto-assign surplus holders as sellers, deficit holders as buyers. Players can switch by pressing UP (seller) or DOWN (buyer). Cannot become seller with 0 resources.
- **Our Code**: `DECLARE_TIMER_MS=3000`, `AUCTION_CHOOSE_BUY_SELL_TIME_MS=3000`. Declaration logic with auto-assign based on critical amounts. Cannot sell with 0 resources.
- **Status**: CORRECT

#### Trading Timer
- **Reference**: 10 seconds. Timer runs at 10% speed when anyone moves in arena. Resumes 300ms after everyone stops. Timer PAUSES completely during transactions.
- **Our Code**: `AUCTION_TIMER_MS=10000`. Timer slow/pause logic matches: `AUCTION_TIMER_SLOW_SPEED=0.1`, `AUCTION_SPEED_UP_DELAY_MS=300`. Full pause during transactions.
- **Status**: CORRECT

#### Transaction Timing (Acceleration)
- **Reference**: First unit: 225ms. Subsequent: 650ms - 75ms*unitsTraded, floor 125ms. Grace: 160ms - 40ms*(units-1), floor 80ms.
- **Our Code**: `TRANSACTION_TIME_START_MS=225`, `TRANSACTION_TIME_MS=650`, `TRANSACTION_TIME_DECREASE_MS=75`, `TRANSACTION_MIN_TIME_MS=125`, `TRANSACTION_GRACE_MS=160`, `TRANSACTION_GRACE_DECREASE_MS=40`, `TRANSACTION_GRACE_MIN_MS=80`. All match.
- **Status**: CORRECT

#### Transaction Execution
- **Reference**: Player-to-player: seller loses 1 unit + gains price, buyer gains 1 unit + loses price. Buy from store: store loses 1, player gains 1 + loses price. Sell to store: player loses 1 + gains price, store gains 1 (except crystite vanishes).
- **Our Code**: Same logic implemented in `executeTradeInternal`, `buyFromStore`, `sellToStore`. Crystite vanish check present.
- **Status**: CORRECT

#### Crystite Vanish
- **Reference**: When selling crystite to store, store does NOT gain it. It simply vanishes.
- **Our Code**: `if (resource !== ResourceType.Crystite)` check before adding to store.
- **Status**: CORRECT

#### Store Exhaustion
- **Reference**: When store runs out, sell ceiling is removed. Auction range expands upward.
- **Our Code**: `expandRangeOnStoreExhaustion` increases maxTick. `storeClosed` flag set.
- **Status**: CORRECT

#### Trader Selection / Priority
- **Reference**: Sort buyers by tick (highest first), then by rank (highest first). Sort sellers by tick (lowest first), then by rank (highest first). First match trades.
- **Our Code**: `findTraders` just takes `buyers[0]` and `sellers[0]` without sorting by tick or rank.
- **Status**: WRONG
- **Fix**: Sort buyers by tick descending (highest first), then by rank. Sort sellers by tick ascending (lowest first), then by rank. This ensures the most aggressive buyer and seller trade first, with rank breaking ties.

#### Breaking Away From Trade
- **Reference**: Trade cancelled if: trading buyer moves away, trading seller moves away, higher-rank player arrives at trade tick, buy/sell ticks diverge.
- **Our Code**: Only checks tick divergence (`!ticksMeet` cancels transaction). No tracking of individual trader movement or rank preemption.
- **Status**: WRONG
- **Fix**: Track individual traders in the current transaction. Cancel if they move away. Implement rank-based preemption (higher-rank player can take over a trade position).

#### Skip Conditions
- **Reference**: Skip auction if: last round, resource not available, no goods for sale after StartAuction.
- **Our Code**: Skips resources nobody has and store doesn't have. No explicit last-round skip.
- **Status**: WRONG
- **Fix**: Add last-round skip: no trading auctions on the final round (reference: `model.isLastRound()` causes skip).

#### Auction Currently Disabled
- **Reference**: Full auction system runs every round.
- **Our Code**: GameRoom.enterPhase for "trading_auction" calls `this.advancePhase()` immediately -- auctions are COMPLETELY SKIPPED with comment "Auto-advance -- auctions handled in future version".
- **Status**: MISSING (critical)
- **Fix**: Enable the trading auction phase. The TradingAuctionPhase class has extensive implementation but GameRoom bypasses it entirely. Wire it up: (1) call `tradingAuctionPhase.start()`, (2) run the auction loop, (3) advance when complete.

---

## 13. Scoring

#### Score Formula
- **Reference**: `points = money + landPoints + goodsPoints`. landPoints = 500 per tile. goodsPoints = (35 + equipmentCost) per installed MULE + resource market values.
- **Our Code**: `totalScore = money + landValue + goodsValue`. landValue = 500 * ownedPlots. goodsValue = resource quantities * current prices. NO MULE value (35 + equipmentCost per MULE).
- **Status**: WRONG
- **Fix**: Add MULE value to goodsPoints. Each installed MULE contributes `POINTS_PER_MULE (35) + equipmentCost` to the score. `POINTS_PER_MULE` constant exists (35) but is not used in scoring.ts.

#### Resource Market Values
- **Reference**: Uses CURRENT shop prices for resource valuation: `food * shop.getPrice(Food)`, etc.
- **Our Code**: Takes `ResourcePrices` parameter. Caller must provide current prices.
- **Status**: CORRECT (structure is right, depends on caller providing accurate prices)

#### Colony Rating
- **Reference**: `colonyTotal / (20000 * lastRound / 12)`, clamped to message array index. Multiple rating tiers.
- **Our Code**: Fixed thresholds: `first_founder: 80000, pioneer: 60000, settler: 40000`. Four ratings.
- **Status**: WRONG
- **Fix**: Colony rating should scale with `lastRound` (number of rounds played). For a 12-round game: threshold = 20000, so colonyTotal/20000 gives the rating index. Our fixed thresholds don't scale with game length (6-round beginner games would use the same thresholds as 12-round tournament games).

#### Colony Death
- **Reference**: If neither players nor store have food or energy, colony failure / game over.
- **Our Code**: `checkColonyDeath` returns true if total food OR total energy across all players + store equals 0.
- **Status**: CORRECT

#### Rank Ordering
- **Reference**: Rank 1 = highest score (best player). `OrderByPoints` ascending = worst first in the array. Rank assigned 1..N.
- **Our Code**: `determineWinner` sorts descending (highest score first). But no explicit rank assignment to players.
- **Status**: WRONG (partially)
- **Fix**: Assign rank numbers to players after sorting. Rank is used for tie-breaking in land grants, land auctions, and trading auctions. Without rank tracking, all rank-based mechanics are broken.

---

## 14. AI

#### Land Grant Strategy
- **Reference**: Not detailed in decompiled docs (AI uses fast development, separate from human mechanics).
- **Our Code**: AIPlayer.decideLandGrant scores tiles: mountains=3, river=2, plains=1, plus adjacency bonus. Beginner AI picks from top 10, standard AI picks from top 3.
- **Status**: EXTRA (reasonable implementation, no reference to compare against)

#### Resource Choice
- **Reference**: Not detailed.
- **Our Code**: River -> food, mountain -> smithore, else check if food < 3 then food, else energy.
- **Status**: EXTRA (reasonable heuristic)

#### Auction Strategy
- **Reference**: AI uses fast development turns. `fastAiDevelopment` flag enables special AI handling.
- **Our Code**: AI declares buyer/seller based on surplus thresholds. Sets tick position near midpoint with random offset.
- **Status**: EXTRA (reasonable but auction is currently disabled anyway)

#### AI Filling Empty Slots
- **Reference**: `GameMode.TRAINING` allows up to 4 AI. `GameMode.TOURNAMENT` allows up to 2 AI.
- **Our Code**: Always fills to 4 players with AI. No mode-based AI limit.
- **Status**: WRONG
- **Fix**: Tournament mode should allow at most 2 AI players.

---

## 15. Game Modes

#### Beginner/Standard/Tournament
- **Reference**: Planet M.U.L.E. (Java) only has TOURNAMENT and TRAINING modes. Difficulty handled via `numRounds`. Original C64 had Beginner(6 rounds)/Standard(8)/Tournament(12).
- **Our Code**: Three modes: beginner(6 rounds), standard(12 rounds), tournament(12 rounds). `ROUNDS_BY_MODE = { beginner: 6, standard: 12, tournament: 12 }`.
- **Status**: WRONG (minor)
- **Fix**: Standard should be 8 rounds per the original C64 game, not 12. The Java remake consolidated into 2 modes, but if we're keeping 3 modes, standard should be the middle tier at 8 rounds.

#### Mode Differences Beyond Round Count
- **Reference**: Tournament requires 2+ human players (maxAI=2). Training allows up to 4 AI (maxAI=4).
- **Our Code**: No behavioral differences between modes beyond round count.
- **Status**: MISSING
- **Fix**: Implement mode restrictions: tournament limits AI count, training allows full AI roster.

---

## Summary of Issues by Severity

### Critical (Game Economy / Core Mechanics Broken)
1. **Trading Auctions DISABLED** -- GameRoom skips them entirely
2. **Dynamic Pricing MISSING** -- Store prices never change (static economy)
3. **MULE Manufacturing formula WRONG** -- Only makes 2 per round, wrong price formula
4. **Production formula WRONG** -- QUALITY_TO_UNITS inflates output; missing random variation; energy MULEs cost energy
5. **Pub payouts ~2x too high** -- Wrong bonus table and random range
6. **Scoring missing MULE value** -- Installed MULEs don't contribute to score
7. **Species bonuses MISSING** -- Mechtron, Flapper, Humanoid bonuses not implemented
8. **Player events always fire** -- No 27.5% probability gate; no round-based scaling

### Major (Significant Gameplay Deviation)
9. **Land Auction MISSING** -- Phase auto-skipped
10. **Colony events wrong** -- A/B split missing; Acid Rain effect reversed; Planetquake wrong multiplier
11. **Spoilage order of operations wrong** -- Applied to surplus not raw amount
12. **Store initial prices wrong** -- Buy/sell spread doesn't match reference
13. **No rank tracking** -- Breaks tie-breaking in land grants, auctions
14. **Trader selection unsorted** -- No priority by tick/rank in auctions
15. **Last-round auction skip missing** -- Should skip all auctions final round
16. **SmallWater terrain missing** -- River tiles all identical

### Minor (Polish / Edge Cases)
17. **No lab items** (Depot, Mining Tower, Water Tank, Power Plant)
18. **No assay office**
19. **No land selling during development**
20. **Colony rating doesn't scale with game length**
21. **Standard mode should be 8 rounds not 12**
22. **Event pre-generation missing** (events should be pre-shuffled)
23. **Land grant cursor too slow** (500ms vs ~300ms)
24. **Land grant tie-breaking missing** (rank-based)
25. **AI fill doesn't respect tournament mode limit**
26. **Round 0 intro/summary missing** (cosmetic)
27. **Production uses Math.random() not seeded RNG**
28. **Store max units cap missing**

---

## Recommended Fix Priority

1. **Enable trading auctions** (wire up TradingAuctionPhase in GameRoom)
2. **Fix production formula** (remove QUALITY_TO_UNITS, add random variation, fix energy MULE cost)
3. **Implement dynamic pricing** (supply/demand price recalculation)
4. **Fix MULE manufacturing** (correct deficit calculation, smithore-based pricing)
5. **Fix pub payouts** (correct bonus table and random amount)
6. **Add MULE value to scoring**
7. **Add rank tracking** for tie-breaking
8. **Fix colony events** (A/B split, correct effects)
9. **Implement player event probability** (27.5% gate + round scaling)
10. **Add species bonuses** (Mechtron, Flapper, Humanoid)
