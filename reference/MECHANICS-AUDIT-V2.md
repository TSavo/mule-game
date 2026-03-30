# M.U.L.E. Mechanics Audit V2 - Definitive

Comprehensive comparison of web implementation vs Planet M.U.L.E. Java decompilation.
Audited: 2026-03-31. All findings verified against current source code.

---

## CRITICAL (10) - Economy/gameplay breaking

### C1. STORE PRICES ARE STATIC - NO DYNAMIC PRICING
**File**: `packages/shared/src/store.ts:26-33`
**Problem**: `getStoreBuyPrice()` and `getStoreSellPrice()` return hardcoded constants. Prices never change regardless of supply/demand.
**Java**: Prices recalculate every round based on colony-wide supply and demand. Store buy/sell prices shift up when scarce, down when abundant. This is THE core economic mechanic of M.U.L.E.
**Fix**: Implement dynamic pricing: `price = initialPrice + priceRange * (demand - supply) / totalPlayers`. Recalculate at start of each auction round.

### C2. LAND AUCTION DISABLED IN GAMEROOM
**File**: `packages/server/src/rooms/GameRoom.ts` (enterPhase for land_auction)
**Problem**: Phase immediately advances with no auction. `LandAuctionPhase` exists but is never wired up.
**Java**: After land grant, unclaimed plots go to timed auction with real bidding (price rises over 34.25s, first claimant wins at current price).
**Fix**: Wire LandAuctionPhase into GameRoom. Add bid message handlers. Run auction timer.

### C3. SCORING DOESN'T COUNT MULE VALUES
**File**: `packages/server/src/phases/ScoringPhase.ts:28,31`
**Problem**: `calculateColonyScore(players, prices)` and `determineWinner(players, prices)` are called WITHOUT the `tiles` parameter. The `tiles` parameter is what enables MULE value counting ($35 + outfit cost per installed MULE). All MULE investment is invisible to scoring.
**Fix**: Pass tiles array to both calls: `calculateColonyScore(players, prices, tileArray)` and `determineWinner(players, prices, tileArray)`.

### C4. MULE MANUFACTURING WRONG
**File**: `packages/shared/src/store.ts:21-24`
**Problem**: Always manufactures `min(storeSmithore, 2)` MULEs per round. No cap on total MULEs.
**Java**: Manufacturing rate = 2 per round BUT total MULEs capped at 14. If store already has 14+, no new MULEs. Also smithore cost is 1 per MULE (correct), but price formula is wrong.
**Fix**: Add cap: `const canManufacture = Math.min(storeSmithore, 2, Math.max(0, 14 - currentMules))`.

### C5. MULE PRICE FORMULA WRONG
**File**: `packages/shared/src/store.ts:15-19`
**Problem**: Uses custom scarcity formula: `MULE_BASE_PRICE * (1 + scarcityFactor)`. When 0 MULEs, price = 3x base ($300).
**Java**: MULE price = fixed $100 base + smithore equipment cost. Scarcity means unavailability, not higher price. When store has 0 MULEs, you simply can't buy one.
**Fix**: MULE price = $100 always (when available). Remove scarcity pricing. Return null/unavailable when `muleCount <= 0`.

### C6. PRODUCTION USES Math.random() NOT SEEDED RNG
**File**: `packages/server/src/economy/EconomyEngine.ts:36`
**Problem**: Energy allocation shuffle uses `Math.random()` instead of the game's seeded RNG. This breaks determinism - same game seed produces different results.
**Fix**: Pass `SeededRNG` to `runProduction()` and use it for the shuffle.

### C7. PRODUCTION MISSING PARTIAL POWER
**File**: `packages/shared/src/production.ts:68`
**Problem**: `energyModifier` is binary 0 or 1. No energy = zero production.
**Java**: Three tiers: no energy = 0 output, partial energy = capacity/2 (half), full energy = full capacity. A MULE that doesn't get energy still produces at half rate.
**Fix**: Change `energyModifier` to support 0.0, 0.5, and 1.0. In EconomyEngine, track which tiles got energy vs didn't and assign 0.5 modifier to unpowered tiles (not 0).

### C8. COLONY EVENTS NOT SPLIT INTO A/B
**File**: `packages/server/src/phases/RandomEventPhase.ts`
**Problem**: Single `execute()` handles all events. No distinction between Colony Event A (before development) and Colony Event B (after production). The phase flow calls it twice but it rolls independently each time.
**Java**: Colony events are pre-generated at game start from a weighted pool (PIRATE_SHIP x2, ACID_RAIN x3, SUNSPOT x3, FIRE_IN_STORE x2). Event A fires before development, Event B fires after production. They're different events from the same pre-shuffled deck.
**Fix**: Generate colony event deck at game start. Draw from deck for A/B slots. Player events remain random per-round.

### C9. GOOD EVENTS CAN TARGET FIRST-PLACE PLAYER
**File**: `packages/server/src/phases/RandomEventPhase.ts:17-24`
**Problem**: "Trailing" events target whoever has least money. No restriction on good events targeting the leader.
**Java**: Good events (money gains, resource gains) CANNOT target the first-place player. In final 2 rounds, events always target the worst-ranked player.
**Fix**: After selecting event, if it's a good event and target is rank 1, re-target to rank 2+ player. In rounds 11-12, always target worst-ranked.

### C10. PLAYER RANKING NOT TRACKED
**File**: `packages/server/src/state/PlayerSchema.ts`
**Problem**: No `rank` or `score` field on PlayerSchema. Turn order uses money as proxy. Auctions, events, and tie-breaking all need actual score-based ranking.
**Java**: Explicit rank 1..N assigned after each scoring phase. Used for: turn order, event targeting, auction tie-breaking, land grant priority.
**Fix**: Add `rank: number` and `score: number` to PlayerSchema. Update after each scoring phase.

---

## MAJOR (8) - Significant gameplay deviation

### M1. COLLECTION PHASE EMPTY
**File**: GameRoom.ts (collection phase handler)
**Problem**: Collection phase exists in phase sequence but does nothing visible. No resource pickup from store, no display of production/spoilage breakdown.
**Java**: Collection is an 8-stage animated sequence showing: previous amounts, usage/consumption, current units, spoilage, intermediate units, production, final results, end. This is where players see what happened.
**Fix**: Implement collection data assembly (already calculated by EconomyEngine, just needs state fields for client display).

### M2. LAND AUCTION TIE-BREAKING WRONG
**File**: `packages/server/src/phases/LandAuctionPhase.ts:39`
**Problem**: On tie, higher playerIndex wins (`playerIndex > winner`).
**Java**: Round 1: random selection from tied players. Other rounds: worst-ranked player wins (lowest score gets preference).
**Fix**: Accept round number and player ranks. Round 1: use RNG to pick among tied. Others: pick lowest-ranked.

### M3. EVENT AMOUNTS DON'T SCALE BY ROUND
**File**: `packages/shared/src/events.ts:6-98`
**Problem**: All event amounts are fixed constants (e.g., +3 food, +$150, -$200).
**Java**: Event amounts scale with round number. Later rounds have larger effects. Formula: `baseAmount * (1 + round/12)` approximately.
**Fix**: Add round multiplier to `applyEventEffect()`. Scale amounts proportionally.

### M4. PRODUCTION MISSING GAUSSIAN VARIATION
**File**: `packages/shared/src/production.ts:68`
**Problem**: Production output is deterministic: `(baseOutput + adjacencyBonus) * energyModifier`.
**Java**: Each factory's output includes a small random Gaussian variation (~+/-1 unit). `capacity = yieldPotential + adjacencyBonus + temporaryBonus + normalRandom()`.
**Fix**: Add `Math.round(rng.nextGaussian())` (clamped to +/-1) to production output. Requires passing RNG.

### M5. SPOILAGE DURING COLLECTION NOT SEPARATED
**File**: `packages/server/src/phases/ProductionPhase.ts:8-9`
**Problem**: Spoilage is applied immediately after production in the same phase call. No intermediate state for the collection display.
**Java**: Spoilage is calculated and displayed during Collection phase (stage 4), separately from production (stage 6). Players see spoilage happen visually.
**Fix**: Split spoilage into collection phase. Store pre-spoilage and post-spoilage values for display.

### M6. STORE INVENTORY NOT CAPPED
**File**: `packages/shared/src/store.ts`
**Problem**: No maximum inventory for store resources.
**Java**: Store has max capacity per resource. Excess from player sales is rejected.
**Fix**: Add `STORE_MAX_INVENTORY` constant and enforce in store buy/sell functions.

### M7. AUCTION RESOURCE-SPECIFIC SKIP LOGIC
**File**: GameRoom.ts auction handling
**Problem**: All 4 resource auctions always run, even if no one has or wants that resource.
**Java**: Crystite auction is SKIPPED entirely if no one has crystite to sell. Other resources skip if no buyers AND no sellers declare.
**Fix**: Check declarations before starting each resource auction. Skip if no participants.

### M8. DEVELOPMENT TURN ORDER USES MONEY NOT SCORE
**File**: `packages/server/src/phases/DevelopmentPhase.ts`
**Problem**: Turn order sorts by `player.money` as proxy for player rank.
**Java**: Turn order based on actual player score (money + land + goods + MULEs). Worst player goes first when MULEs scarce, best first when abundant.
**Fix**: Use calculated score from ScoringPhase, not just money.

---

## MINOR (12) - Polish/edge cases

### m1. NO SMALLWATER/SWAMP TERRAIN
**Problem**: Only terrain types are River, Plains, Mountain1/2/3, Town. Java has SmallWater (different from River).
**Impact**: Low - can be added later as terrain variant.

### m2. NO ASSAY OFFICE
**Problem**: Assay office in town lets players reveal crystite levels of their plots for a fee ($50). Not implemented.
**Impact**: Medium for crystite strategy. Add as town action.

### m3. NO LAND SELLING
**Problem**: Players can't sell plots back to the store. Java allows this during development.
**Impact**: Medium - removes a strategic option for cash-strapped players.

### m4. NO DEPOT (PREVENTS SPOILAGE)
**Problem**: In Java, owning the town center plot (depot) prevents all spoilage. Not implemented.
**Impact**: Low - rare strategic play.

### m5. SPECIES BONUSES INCOMPLETE
**Problem**: Mechtron (requires 0 food, always max turn time) and Humanoid (+25% production bonus) not fully implemented. Flapper double-pub IS implemented.
**Impact**: Medium - affects species selection strategy.

### m6. COLONY RATING THRESHOLDS MAY BE WRONG
**Problem**: Thresholds are 80k/60k/40k. Need verification against Java.
**Impact**: Low - only affects final rating display.

### m7. NO ROUND 0 INTRO SEQUENCE
**Problem**: Java has intro sequence (INTRO phase) before round 1. Web jumps straight to land grant.
**Impact**: Low - cosmetic.

### m8. WAMPUS ONLY DURING DEVELOPMENT
**Problem**: Wampus appears during development and catching it gives bounty. Implementation exists in DevelopmentPhase but wampus spawn/catch mechanics not visible for human players.
**Impact**: Low-medium - fun mechanic but not core economy.

### m9. CURSOR SPEED DURING LAND GRANT
**Problem**: Land grant cursor scan speed may not match Java timing (18 frames per plot at 60fps = 300ms).
**Impact**: Low - tuning parameter.

### m10. NO TOURNAMENT MODE AI CAP
**Problem**: Tournament mode should cap AI players at 2 (max 2 human + 2 AI). Currently allows 3 AI.
**Impact**: Low - mode-specific restriction.

### m11. NO CRYSTITE MOUNTAIN QUALITY
**Problem**: `TileSchema` has `crystiteLevel` but no `smithoreLevel`. Mountains have hardcoded smithore quality by mountain type (1/2/3). Should smithore also vary per-tile?
**Impact**: Low - current approach (Mountain1=2, Mountain2=3, Mountain3=4) is a reasonable simplification.

### m12. PIRATE RAID ONLY TAKES CRYSTITE
**Problem**: Implementation correctly zeros crystite. But Java pirate raid takes ALL of one random resource, not just crystite.
**Impact**: Low - current behavior is the most commonly described version.

---

## SUMMARY

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 10 | All open |
| MAJOR | 8 | All open |
| MINOR | 12 | All open |
| **TOTAL** | **30** | **0 fixed** |

## PRIORITY FIX ORDER

**Phase 1 - Core Economy (C1, C3, C5, C10)**
1. Add player rank/score tracking (C10) - everything else depends on it
2. Fix scoring to count MULE values (C3) - pass tiles to scoring functions
3. Fix MULE price to flat $100 (C5) - simple constant change
4. Implement dynamic store pricing (C1) - THE core economic mechanic

**Phase 2 - Production Accuracy (C6, C7, M4, M5)**
5. Pass seeded RNG to production (C6) - determinism fix
6. Add partial power (C7) - 0/0.5/1.0 energy modifier
7. Add Gaussian variation (M4) - small random production variance
8. Split spoilage into collection display (M5)

**Phase 3 - Game Flow (C2, C4, C8, C9)**
9. Wire up land auction in GameRoom (C2)
10. Fix MULE manufacturing cap (C4)
11. Pre-generate colony event deck (C8)
12. Fix event targeting (C9) - no good events for leader

**Phase 4 - Polish (M1-M8, minors)**
13. Collection phase display data (M1)
14. Fix tie-breaking (M2)
15. Scale event amounts by round (M3)
16. Development turn order by score (M8)
17. Store inventory cap (M6)
18. Auction skip logic (M7)
