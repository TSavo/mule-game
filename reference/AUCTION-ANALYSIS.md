# Planet M.U.L.E. Auction System - Complete Technical Analysis

Decompiled from Planet M.U.L.E. v1.3.6 (Turborilla). This document covers every mechanical detail of the trading auction system as implemented in the reference Java code.

---

## Table of Contents

1. [Overall Auction Lifecycle](#1-overall-auction-lifecycle)
2. [The Tick System](#2-the-tick-system)
3. [Collection Phase (Pre-Auction)](#3-collection-phase-pre-auction)
4. [Declaration Phase (Buy/Sell Choice)](#4-declaration-phase-buysell-choice)
5. [Trading Phase](#5-trading-phase)
6. [Transaction Mechanics](#6-transaction-mechanics)
7. [Store Mechanics](#7-store-mechanics)
8. [Price Calculation Between Rounds](#8-price-calculation-between-rounds)
9. [Resource Auction Order and Transitions](#9-resource-auction-order-and-transitions)
10. [Timing Constants Reference](#10-timing-constants-reference)
11. [Key Data Structures](#11-key-data-structures)

---

## 1. Overall Auction Lifecycle

The auction system processes resources in this fixed order each round:

```
COLLECTION_SMITHORE -> AUCTION_SMITHORE ->
COLLECTION_CRYSTITE -> AUCTION_CRYSTITE ->
COLLECTION_FOOD    -> AUCTION_FOOD    ->
COLLECTION_ENERGY  -> AUCTION_ENERGY  ->
SUMMARY
```

Each resource goes through a **Collection Phase** (display production/spoilage, calculate prices) followed by an **Auction Phase** (player trading). After the last resource (Energy), the game transitions to the SUMMARY phase.

### Auction Phase Sub-Stages

Within each `AbstractAuctionPhase`, the lifecycle is:

1. **begin()** - Initialize auction, set buyer/seller defaults, start countdown
2. **Declaration Countdown** - Players choose buy or sell (3s choose + 3s countdown = 6s total)
3. **introTimer** - Brief synchronization delay after countdown
4. **StartAuctionMessage** - Server broadcasts buyer/seller assignments
5. **Trading Phase** - Players move up/down to set prices, transactions happen (10s timer)
6. **outroTimer** - 3 second pause after auction ends
7. **end()** - Calculate average price, transition to next phase

### Skip Conditions

An auction is **skipped entirely** (`skipAuction = true`) when:
- `model.isLastRound()` - No trading on the final round
- `!model.isResourceAvailable(resource)` - No one has or can trade this resource
- After StartAuction, `!goodsForSale()` returns true - No sellers have goods AND store has none

Skip auction shows for `Properties.mule.skipAuctionTime` = **4.0 seconds**, then transitions.

When `!goodsForSale()` is detected after StartAuction, it uses `noGoodsForSaleTime` = **4.0 seconds**.

---

## 2. The Tick System

### Core Concept

The auction uses a **tick-based coordinate system** where each player has an integer "tick" position. Ticks map to prices via a formula. Players move their tick position up (higher price) or down (lower price) by pressing up/down. The visual position on screen is determined by the tick value.

### TickSetup Configuration

```java
// From Auction.java
tickSetupLow  = new TickSetup(pixelRatio=2, scale=10, maxOutOfAuction=40, priceStep=1);
tickSetupHigh = new TickSetup(pixelRatio=2, scale=10, maxOutOfAuction=40, priceStep=4);
```

- **Crystite** uses `tickSetupHigh` (priceStep=4, so prices go up by $4 per "price level")
- **Food, Energy, Smithore** use `tickSetupLow` (priceStep=1, so prices go up by $1 per "price level")

### Tick-to-Price Conversion

```java
// AuctionLimits.java
int tickToPrice(int tick) {
    return startPrice + tick / scale * priceStep;
}
```

Where:
- `startPrice` = the store's buy price for this resource (the floor price)
- `scale` = 10 (ticks per price step)
- `priceStep` = 1 or 4 depending on resource

**Example**: If startPrice=$30 (food buy price), scale=10, priceStep=1:
- Tick 0-9 = $30
- Tick 10-19 = $31
- Tick 20-29 = $32
- etc.

Every 10 ticks = 1 price step. This means there are 10 tick positions at each price level, giving smooth visual movement between price points.

### Price-to-Tick Conversion

```java
int priceToMinTick(int price) {
    return (price - startPrice) / priceStep * scale;
}

int priceToMaxTick(int price) {
    return (priceStep + price - startPrice) / priceStep * scale - 1;
}
```

`priceToMinTick` gives the **lowest** tick that maps to a given price.
`priceToMaxTick` gives the **highest** tick that maps to a given price.

**Example** (food, startPrice=30, priceStep=1, scale=10):
- priceToMinTick($32) = (32-30)/1*10 = 20
- priceToMaxTick($32) = (1+32-30)/1*10 - 1 = 29

So ticks 20-29 all represent $32.

### Min/Max Ticks and the Visible Range

```java
// In AuctionLimits constructor:
minTick = priceToMinTick(buyPrice);   // Store's buy price = bottom of visible range
maxTick = priceToMaxTick(sellPrice);  // Store's sell price = top of visible range
```

The visible auction range spans from the store's buy price (floor) to the store's sell price (ceiling). These are `startMinTick` and `startMaxTick`.

### Dynamic Range Shifting

The visible range can shift based on player positions via `calcBuyAndSellTicks()`:

```java
// If any player (buyer or seller) is above maxTick, shift range up
if (highestTick > maxTick) {
    int shift = highestTick - maxTick;
    maxTick += shift;
    minTick += shift;
}

// If the highest buyer tick is below minTick (only for non-resource/land auctions with recenter enabled)
if (resource == null && recenter && auctionBuyTick < minTick) {
    // Shift range down to keep buyer visible
}
```

### Out-of-Auction Space

Players who are NOT in the auction area occupy "out-of-auction" ticks:
- **Buyers** (below the auction): tick values from `-1` down to `-maxOutOfAuction` (= -40)
- **Sellers** (above the auction): tick values from `1` up to `maxOutOfAuction` (= 40)

When `inAuction = false`:
- Buyers face North and have negative tick values
- Sellers face South and have positive tick values

When a player crosses the boundary (tick 0), they transition between in-auction and out-of-auction:
- A buyer at tick -1 pressing UP goes to `inAuction=true, tick=minTick+0` (enters at bottom)
- A seller at tick 1 pressing DOWN goes to `inAuction=true, tick=maxTick+0` (enters at top)

### Pixel Ratio

`pixelRatio = 2` means each tick = 2 pixels of screen movement. This is used by the rendering layer to position player sprites.

---

## 3. Collection Phase (Pre-Auction)

Source: `CollectionPhase.java`

The collection phase displays production results BEFORE the auction begins. It runs through a series of timed sub-stages:

### Sub-Stage Sequence

| Sub-Stage | Timer | Duration | What Happens |
|-----------|-------|----------|--------------|
| Previous Amount | `previousUnitsTimer` | 2.5s | Show current resource holdings |
| Usage | `usageTimer` | 1.0s | Animate food/energy consumption |
| Current Units | `currentUnitsTimer` | 2.5s | Show post-usage amounts |
| Spoilage | `spoilageTimer` | 1.0s | Animate spoilage reduction |
| Intermediate Units | `intermediateUnitsTimer` | 2.5s | Show post-spoilage amounts |
| Production | `collectionTimer` | 1.0s | Animate production additions |
| Result Units | `resultUnitsTimer` | 4.0s | Show final amounts + critical indicator |
| End | `endTimer` | 5.0s | Pause before auction |

### Resource-Specific Shortcuts

- **Smithore & Crystite**: Skip "Previous Amount" and "Usage" stages (set timers to 0). If no spoilage, also skip "Current Units" and "Spoilage" stages.
- **Last Round, Smithore, Crystite**: Skip "Result Units" stage (no critical display).
- **No Production**: Skip "Production" stage (collectionTimer = 0).

### Spoilage Rules

From `Player.calcSpoilage()`:

```
Food:      floor(food / 2)       — lose half your food
Energy:    floor(energy / 4)     — lose quarter of energy
Crystite:  max(0, crystite - 50) — keep up to 50
Smithore:  max(0, smithore - 50) — keep up to 50
```

If player has a **Depot** (`player.hasDepot()`), spoilage is 0 for all resources.

### Critical Levels

From `Player.getResourceCritical()`:

```
Food:    foodRequirements[round + 1]  (lookup table, typically 3-5)
Energy:  energyRequirement + 1        (based on number of buildings)
Crystite: 0 (never critical)
Smithore: 0 (never critical)
```

If a player has more than the critical amount, they are auto-assigned as a **seller** at auction start. At or below critical = **buyer**.

### Price Calculation During Collection

`Shop.calcBuySellPrice()` is called at the START of each collection phase, before the auction. This recalculates buy/sell prices for the upcoming auction based on supply/demand. See [Section 8](#8-price-calculation-between-rounds) for details.

---

## 4. Declaration Phase (Buy/Sell Choice)

### Timing

```java
float totalTime = auctionChooseBuySellTime + auctionCountdownTime;  // 3.0 + 3.0 = 6.0 seconds
model.getCountdown().start(totalTime, client);
```

The countdown runs for 6 seconds total. During the first 3 seconds (`auctionChooseBuySellTime`), no special UI is shown. During the last 3 seconds (`auctionCountdownTime`), a countdown sound plays.

### Auto-Assignment

In `begin()`, all players are initially set to **buyer**:

```java
player.setBuyer(true, maxOutOfAuctionTicks);
```

Then, if NOT the last round, players with surplus (resource > critical) are auto-assigned as **sellers**:

```java
if (!model.isLastRound()) {
    int currentAmount = player.getResource(resource);
    int criticalAmount = player.getResourceCritical(resource, model);
    if (currentAmount > criticalAmount) {
        player.setBuyer(false, maxOutOfAuctionTicks);
    }
}
```

### Player Switching

During the countdown, players can switch by pressing:
- **UP** = become seller (only if they have > 0 of the resource)
- **DOWN** = become buyer

```java
// From apply(ChooseDirectionMessage)
if (direction == North) {
    if (player.getResource(resource) > 0) {
        player.setBuyer(false, maxOutOfAuctionTicks);  // become seller
    }
} else if (direction == South) {
    player.setBuyer(true, maxOutOfAuctionTicks);  // become buyer
}
```

A player cannot become a seller if they have 0 of the resource.

### setBuyer() Implementation

```java
void setBuyer(boolean isBuyer, int maxOutOfAuction) {
    auctionBuyer = isBuyer;
    int tick = isBuyer ? -maxOutOfAuction : maxOutOfAuction;  // -40 or +40
    auctionState.setState(false, tick);       // NOT in auction, at max distance
    targetAuctionState.setState(false, tick);
    avatar.setDirection(isBuyer ? North : South);
}
```

Buyers start at tick -40 (far below auction area, facing up). Sellers start at tick +40 (far above auction area, facing down).

### Transition to Trading

When the countdown finishes:
1. Server waits for max network roundtrip time, then fires `introTimer`
2. `introTimer.finished()` collects all buyer/seller assignments
3. Server sends `StartAuctionMessage` with buyer and seller lists
4. All clients apply the message, which calls `startAuction(auctionTime=10.0f)`

---

## 5. Trading Phase

### Auction Timer

The trading phase lasts `auctionTime` = **10.0 seconds** on the phase timer. However, the timer speed is dynamically adjusted:

```java
// When any player moves while in the auction area:
void slowAuctionTimer() {
    phaseTimer.setSpeed(auctionTimerSlowSpeed);  // 0.1 (10% speed = nearly paused)
    auctionIncreaseSpeedTime = now + auctionTimeSpeedUpDelay;  // +300ms
}

// In update(), when no one is moving and speed-up delay has passed:
if (!phaseTimer.isPaused() && now >= auctionIncreaseSpeedTime) {
    phaseTimer.setSpeed(1.0f);  // Resume normal speed
}
```

This means the auction timer **nearly freezes** whenever anyone is actively moving in the auction area, and resumes **300ms after everyone stops moving**. The 10-second timer effectively only counts down when all players are idle.

### Player Movement

Players move at `auctionSpeed = 3` ticks per frame. Each frame, for each local player:

```java
for (int i = 0; i < player.getAuctionSpeed(); i++) {
    if (isUp && !isDown) {
        move(player, North);   // tick + 1
    } else if (isDown && !isUp) {
        move(player, South);   // tick - 1
    } else {
        move(player, None);    // stay, revalidate position
        break;
    }
}
```

At 60 FPS with speed 3, a player moves 180 ticks per second. With scale=10, that's 18 price levels per second.

### Remote Player Interpolation

Remote players' positions are interpolated toward their target state:

```java
// If remote player is far behind (> 16 ticks), speed up
if (distance > 16) {
    player.setAuctionSpeed(auctionSpeed + 1);  // 4 instead of 3
}

// Move one tick at a time toward target
auctionState.moveTowards(targetAuctionState, limits, resource, player);
```

### Boundary Rules for Buyers (AuctionState.setTick)

When a **buyer** is in the auction (`inAuction = true`):

1. **Cannot exceed seller tick**: `if (tick > auctionSellTick) tick = auctionSellTick`
2. **Cannot exceed money**: If `tickToPrice(tick) > player.getMoney()`, clamp to `priceToMaxTick(money)`. If that's below minTick, exit auction.
3. **Cannot go below minTick**: If `tick < minTick`, set `inAuction = false, tick = -1` (exit auction)

When a **buyer** is outside auction (`inAuction = false`):
1. If tick goes >= 0, transition to `inAuction = true` at `minTick + tick`
2. Cannot go below `-maxOutOfAuction` (= -40)

### Boundary Rules for Sellers (AuctionState.setTick)

When a **seller** is in the auction (`inAuction = true`):

1. **Cannot go below buyer tick**: `if (tick < auctionBuyTick) tick = auctionBuyTick`
2. **Cannot go below minTick**: `if (tick < minTick) tick = minTick`
3. **Cannot exceed maxTick**: If `tick > maxTick`, set `inAuction = false, tick = tick - maxTick` (exit auction)

When a **seller** is outside auction (`inAuction = false`):
1. If tick goes <= 0, transition to `inAuction = true` at `maxTick + tick`
2. **Cannot enter with 0 resources**: If `player.getResource(resource) == 0`, tick is forced to 1 (stay out)
3. Cannot exceed `maxOutOfAuction` (= 40)

### calcBuyAndSellTicks() - The Price Line System

This method (`AuctionLimits.calcBuyAndSellTicks()`) computes two critical values each frame:

- `auctionBuyTick` = the **highest** tick among all buyers who are in the auction
- `auctionSellTick` = the **lowest** tick among all sellers who are in the auction

These represent the "price lines" that constrain the opposing side:
- Buyers cannot move above the sell line
- Sellers cannot move below the buy line

When `auctionBuyTick == auctionSellTick`, buyer and seller have **met** at the same price, and a transaction can occur.

### Store Price Lines

After computing player-based buy/sell ticks, the store's prices act as additional bounds:

```java
// Store acts as buyer-of-last-resort at its buy price
int storeBuyTick = priceToMinTick(shop.getBuyPrice(resource));
if (storeBuyTick > auctionBuyTick && storeBuyTick >= minTick) {
    auctionBuyTick = storeBuyTick;
}

// Store acts as seller-of-last-resort at its sell price (if it has stock)
int storeSellTick = priceToMaxTick(shop.getSellPrice(resource));
if (storeSellTick < auctionSellTick && shop.getResource(resource) > 0) {
    auctionSellTick = storeSellTick;
}
```

---

## 6. Transaction Mechanics

Source: `AbstractAuctionPhase.doTransactions()` (server-side only)

### When Do Transactions Happen?

A transaction is possible when `auctionBuyTick == auctionSellTick` (buyer and seller lines meet at the same tick/price).

### Transaction Cooldown

After a trade completes (units were traded), there's a cooldown:

```java
if (unitsTraded > 0) {
    tradeCooldown = Properties.mule.transactionTime;  // 650ms
}
```

The cooldown decrements each frame by `1000 / framesPerSecond` (= ~16.67ms at 60fps).

### Trader Selection (Who Trades?)

When buy and sell ticks meet:

1. **Sort buyers** by tick (highest first), then by rank (highest first) - `PlayersByPriceBigFirst`
2. **Sort sellers** by tick (lowest first), then by rank (highest first) - `PlayersByPriceSmallFirst`
3. Take the **first buyer** and **first seller** whose ticks both equal the trade tick
4. If no player-to-player pair, check for **store trades** (see below)

Rank tiebreaker: Higher rank gets priority. If same rank (should not happen), higher playerIndex wins.

### Transaction Timing (Accelerating Speed)

The time before each unit trades follows an accelerating pattern:

```java
if (unitsTraded == 0) {
    // First unit: longer delay
    delay = transactionTimeStart;     // 225ms
    if (tradeCooldown > delay) delay = tradeCooldown;
    delay += min(highestRoundtripTime, 800);  // Network compensation, capped at 800ms
} else {
    // Subsequent units: decreasing delay
    delay = transactionTime;          // 650ms
    delay -= unitsTraded * transactionTimeDecrease;  // -75ms per unit
}

if (delay <= transactionMinTime) {
    delay = transactionMinTime;       // Floor: 125ms
}
```

**Transaction speed progression** (ignoring network):
- Unit 0: 225ms (initial)
- Unit 1: 650 - 75 = 575ms
- Unit 2: 650 - 150 = 500ms
- Unit 3: 650 - 225 = 425ms
- Unit 4: 650 - 300 = 350ms
- Unit 5: 650 - 375 = 275ms
- Unit 6: 650 - 450 = 200ms
- Unit 7+: 650 - 525 = 125ms (minimum, stays here)

### Grace Period

When all players have acknowledged the current transaction count, a grace time is calculated:

```java
long graceTime = transactionGraceTime;          // 160ms
graceTime -= (unitsTraded - 1) * transactionGraceDecrease;  // -40ms per prior trade
if (graceTime < transactionGraceMin) {
    graceTime = transactionGraceMin;             // Floor: 80ms
}

// Only extend if grace would push past current deadline
long graceDeadline = now + graceTime;
if (graceDeadline > transactionTime) {
    transactionTime = graceDeadline;
}
```

Grace progression:
- After unit 0: 160ms
- After unit 1: 120ms
- After unit 2: 80ms (minimum, stays here)

### Transaction Execution

When `System.currentTimeMillis() >= transactionTime` and `readyForTransaction()`:

```java
int price = auctionLimits.tickToPrice(tradeTick);
TransactionMessage msg = new TransactionMessage(price, tradingBuyers, tradingSellers);
client.sendTCP(msg);
auctionController.transaction();  // Increment transaction counter
tradersLocked = true;             // Lock current traders in
```

### apply(TransactionMessage) - The Actual Trade

Three cases:

#### Case 1: Player buying from Store (sellers list empty)

```java
for (buyer in transactionMessage.buyers) {
    if (shop.getResource(resource) == 0) continue;  // Store exhausted
    if (price > buyer.getMoney()) continue;          // Can't afford
    shop.resource -= 1;
    buyer.resource += 1;
    buyer.money -= price;
}
```

#### Case 2: Player selling to Store (buyers list empty)

```java
for (seller in transactionMessage.sellers) {
    if (seller.getResource(resource) <= 0) continue;  // Nothing to sell
    if (resource != Crystite) {
        shop.resource += 1;  // Store gains resource (except crystite!)
    }
    seller.resource -= 1;
    seller.money += price;
}
```

**Important**: When selling Crystite to the store, the store does NOT gain the crystite. It simply vanishes. This is a deliberate mechanic.

#### Case 3: Player-to-Player Trade

```java
if (seller.resource > 0 && price <= buyer.money) {
    seller.resource -= 1;
    seller.money += price;
    buyer.resource += 1;
    buyer.money -= price;
}
```

### Post-Transaction Checks

After each transaction:

1. **Store exhausted**: If selling from store and store hits 0, clear tradingBuyers
2. **Buyer out of money**: If buyer can't afford the current price anymore, teleport them (revalidate position), remove from trading
3. **Seller out of goods**: If seller has 0 resource or hits critical level, remove from trading, convert to buyer
4. Track `totalUnitsTraded` and `totalUnitsPrice` for average price calculation

### Breaking Away From a Trade

`checkCancelTransactions()` runs every frame (server-side). A trade is cancelled when:

1. **A trading buyer moves away**: If a buyer in `tradingBuyers` has a target tick != tradeTick, the entire trade stops (`stopTrading()`)
2. **A trading seller moves away**: If a seller in `tradingSellers` moves away, they're removed. If no sellers left, trade stops.
3. **Higher-rank player enters**: If a non-trading player arrives at the trade tick with a higher rank than the current trader, trade is reset and the higher-rank player takes over.
4. **Buy and sell ticks diverge**: If `auctionBuyTick != auctionSellTick`, all trading stops immediately.

### Timer Pausing During Transactions

When a transaction begins: `phaseTimer.pause(true)` (BeginTransactionMessage)
When a transaction ends: `phaseTimer.pause(false)` (EndTransactionMessage)

This means the auction timer **completely stops** while a transaction is in progress. Combined with the slow-down during movement, the 10-second timer only truly counts down when no one is moving and no transaction is happening.

---

## 7. Store Mechanics

### Store as Market Maker

The store acts as both buyer-of-last-resort and seller-of-last-resort:

- **Buy price** = the price at which the store buys FROM players (lower price, floor)
- **Sell price** = the price at which the store sells TO players (higher price, ceiling)

The spread between buy and sell price is the store's margin.

### Store Price Lines in Auction

The store's prices create invisible "walls" in the auction:

```java
// Store buy tick = floor for sellers (they can't sell below this)
int storeBuyTick = priceToMinTick(shop.getBuyPrice(resource));
if (storeBuyTick > auctionBuyTick) {
    auctionBuyTick = storeBuyTick;  // Store offers to buy at this price
}

// Store sell tick = ceiling for buyers (they can't buy above this unless store exhausted)
int storeSellTick = priceToMaxTick(shop.getSellPrice(resource));
if (storeSellTick < auctionSellTick && shop.getResource(resource) > 0) {
    auctionSellTick = storeSellTick;
}
```

### Store Exhaustion ("Store Closed")

When the store runs out of a resource during the auction, the price ceiling is removed:

```java
// In update(), checked each frame:
int storeSellMaxTick = auctionLimits.priceToMaxTick(shopSellPrice);
if (auctionLimits.getMaxTick() > storeSellMaxTick) {
    // Max tick has exceeded store sell price = store is exhausted
    sendStoreClosedMessage();
    storeClosed();
}
```

`storeClosed()` extends the visible range:

```java
void storeClosed() {
    int tick = priceToMaxTick(shopSellPrice);
    currentLimits.increaseMaxTick(tick + 1);
    targetLimits.increaseMaxTick(tick + 1);
    storeClosed = true;
}
```

`increaseMaxTick()` shifts both min and max ticks up:

```java
void increaseMaxTick(int newMax) {
    if (newMax > maxTick) {
        int shift = newMax - maxTick;
        maxTick += shift;
        minTick += shift;
    }
}
```

This means when the store is exhausted, the auction range expands upward, allowing prices to exceed the former store sell price. Players can now trade at higher prices without the store ceiling.

### Store Inventory

Initial stock from `Properties.java`:

```
Food:      8 units
Energy:    8 units
Smithore:  8 units
Crystite:  0 units (store never has crystite!)
Mules:     14
```

Maximum store units: 255 (per `maxShopUnits`).

### Crystite Special Rule

When selling crystite to the store, the store does NOT accumulate it:

```java
if (resource != Resource.Crystite) {
    shop.setResource(resource, shop.getResource(resource) + 1);
}
```

Crystite sold to the store simply vanishes. The store starts with 0 crystite and can never have any.

### Mule Building

The store builds mules from smithore between rounds:

```java
void buildMules() {
    int smithorePerMule = 2;
    int deficit = shopStartNumMules - numMules;  // How many mules to replace
    deficit = min(deficit, shopMaxBuildMules);     // Cap at 14
    int smithoreCost = deficit * 2;
    if (smithoreCost > smithore) {
        smithoreCost = smithore - smithore % 2;   // Use available, round down
    }
    smithore -= smithoreCost;
    numMules += smithoreCost / 2;
    mulePrice = smithorePrice * 2;
    mulePrice -= mulePrice % 10;  // Round down to nearest $10
}
```

---

## 8. Price Calculation Between Rounds

Source: `Shop.calcBuySellPrice()`, called in `CollectionPhase.begin()`

Prices are recalculated at the START of each collection phase. The system uses a `ResourcePrices` class (not in the decompiled set) that calculates buy and sell prices based on supply/demand ratios.

### Food Price Calculation

```java
int totalDemand = numPlayers * foodRequirements[min(round + 1, 12)];
int totalSupply = shop.food;
for (player : players) {
    totalSupply += player.food + player.calcProduction(Food) - player.calcSpoilage(Food);
}
float factor = foodPrices.calcFoodPrice(totalSupply, totalDemand);
```

Supply includes: shop stock + all player holdings + expected production - expected spoilage.
Demand: players * food requirement for next round.

### Energy Price Calculation

```java
int totalSupply = shop.energy;
int totalDemand = 0;
for (player : players) {
    totalSupply += player.energy + player.calcProduction(Energy) - player.calcSpoilage(Energy);
    totalDemand += player.energyRequirement + 1;
}
float factor = energyPrices.calcEnergyPrice(totalSupply, totalDemand);
```

### Smithore Price Calculation

```java
int unclaimedLand = 0;
int ownedWithoutFactory = 0;
for (tile : map) {
    if (tile.owner == null) unclaimedLand++;
    else if (tile.factory == null) ownedWithoutFactory++;
}
int mulesNeeded = min(min(unclaimedLand, numPlayers) + ownedWithoutFactory, 8);
int mulesAvailable = shop.numMules + shop.smithore / 2;
int randomVariation = round(1.0 * normalDistributed(random) * 7.0);  // Gaussian noise ~$7
float factor = smithorePrices.calcSmithorePrice(mulesAvailable, mulesNeeded, randomVariation);
```

Smithore pricing considers: how many mules could be built (available smithore / 2 + current mules) vs how many plots still need mules. Includes random variation.

### Crystite Price Calculation

```java
int randomDeviance = random.nextInt(shopCrystitePriceDeviance);  // 0-99
crystitePrices.calcCrystitePrice(randomDeviance);
```

Crystite is purely random -- no supply/demand calculation.

### Price Ranges

Each resource has a price range that constrains the buy/sell spread:

```
Food:      $35 range
Energy:    $35 range
Smithore:  $35 range
Crystite:  $140 range
```

Initial prices:
```
Food:      buy=$30, sell=$30+range
Energy:    buy=$25, sell=$25+range
Smithore:  buy=$50, sell=$50+range
Crystite:  buy=$50, sell=$50+range
```

### Average Price Tracking

After each auction ends, the average traded price is recorded:

```java
// In end():
if (!model.isLastRound()) {
    shop.setAveragePrice(resource, totalUnitsPrice, totalUnitsTraded);
}

// In Shop.setAveragePrice():
if (unitsTraded > 0) {
    int avgPrice = totalPrice / unitsTraded;
    // Sets the base price for next round's calculation
    foodPrices.setFoodPrice(avgPrice);  // (or energy/smithore/crystite)
}
```

This means the **average auction trading price** becomes the new base price for the next round's buy/sell calculation.

---

## 9. Resource Auction Order and Transitions

### Fixed Order

```
Smithore -> Crystite -> Food -> Energy
```

Each resource goes through Collection then Auction:

```java
// CollectionPhase.setNextPhase():
Smithore -> Phase.AUCTION_SMITHORE
Crystite -> Phase.AUCTION_CRYSTITE
Food     -> Phase.AUCTION_FOOD
Energy   -> Phase.AUCTION_ENERGY

// AbstractAuctionPhase outroTimer.finished():
Smithore -> Phase.COLLECTION_CRYSTITE
Crystite -> Phase.COLLECTION_FOOD
Food     -> Phase.COLLECTION_ENERGY
Energy   -> Phase.SUMMARY
```

### Why This Order?

1. **Smithore first**: Determines mule prices for the round
2. **Crystite second**: High-value, volatile resource
3. **Food third**: Players know their smithore/crystite situation when deciding food
4. **Energy last**: Players know everything when deciding energy

---

## 10. Timing Constants Reference

All values from `Properties.java`:

### Auction Timers

| Constant | Value | Description |
|----------|-------|-------------|
| `auctionChooseBuySellTime` | 3.0s | Time to choose buy/sell before countdown |
| `auctionCountdownTime` | 3.0s | Visible countdown before trading |
| `auctionTime` | 10.0s | Trading phase duration |
| `auctionTimerSlowSpeed` | 0.1 | Timer speed when players are moving (10%) |
| `auctionTimeSpeedUpDelay` | 300ms | Delay before timer resumes after movement stops |
| `skipAuctionTime` | 4.0s | Duration when auction is skipped |
| `noGoodsForSaleTime` | 4.0s | Duration when no goods available |
| `auctionTickTime` | 3.5s | Tick sound interval during auction |

### Transaction Timers

| Constant | Value | Description |
|----------|-------|-------------|
| `transactionTimeStart` | 225ms | Delay before first unit trades |
| `transactionTime` | 650ms | Base delay between subsequent trades |
| `transactionTimeDecrease` | 75ms | Decrease per unit traded |
| `transactionMinTime` | 125ms | Minimum delay between trades |
| `transactionGraceTime` | 160ms | Base grace period for network sync |
| `transactionGraceDecrease` | 40ms | Grace decrease per unit |
| `transactionGraceMin` | 80ms | Minimum grace period |

### Movement

| Constant | Value | Description |
|----------|-------|-------------|
| `auctionSpeed` | 3 | Ticks per frame per player |
| `framesPerSecond` | 60 | Game framerate |
| `delta` | 0.02s | Time per frame |
| `sendAuctionStateInterval` | 4 frames | Network sync interval |

### Collection Phase Timers

| Constant | Value | Description |
|----------|-------|-------------|
| `previousUnitsTime` | 2.5s | Show previous holdings |
| `usageTime` | 1.0s | Animate usage |
| `currentUnitsTime` | 2.5s | Show post-usage |
| `spoilageTime` | 1.0s | Animate spoilage |
| `intermediateUnitsTime` | 2.5s | Show post-spoilage |
| `collectionTime` | 1.0s | Animate production |
| `resultUnitsTime` | 4.0s | Show results + critical |
| `collectionEndTime` | 5.0s | Pause before auction |

### Shop Initial Values

| Constant | Value |
|----------|-------|
| `shopStartFood` | 8 |
| `shopStartEnergy` | 8 |
| `shopStartSmithore` | 8 |
| `shopStartCrystite` | 0 |
| `shopStartNumMules` | 14 |
| `shopFoodInitialPrice` | $30 |
| `shopEnergyInitialPrice` | $25 |
| `shopSmithoreInitialPrice` | $50 |
| `shopCrystiteInitialPrice` | $50 |
| `shopMuleInitialPrice` | $100 |

### Player Start Values

| Constant | Value |
|----------|-------|
| `playerStartMoney` | $1000 |
| `playerStartFood` | 4 |
| `playerStartEnergy` | 2 |
| `playerStartSmithore` | 0 |
| `playerStartCrystite` | 0 |

---

## 11. Key Data Structures

### AuctionLimits

The core state of the auction price system:

```
Fields:
  auctionBuyTick   : int  - Highest tick among in-auction buyers (or store buy tick)
  auctionSellTick  : int  - Lowest tick among in-auction sellers (or store sell tick)
  minTick          : int  - Bottom of visible range
  maxTick          : int  - Top of visible range
  startPrice       : int  - Price at tick 0 (= store buy price)
  startMinTick     : int  - Original minTick at auction start
  startMaxTick     : int  - Original maxTick at auction start
  tickSetup        : TickSetup - Configuration (pixelRatio, scale, maxOutOfAuction, priceStep)
```

### AuctionState (per player)

```
Fields:
  auctionTick : int     - Current tick position
  inAuction   : boolean - Whether player is in the auction area
  walking     : boolean - Whether player is currently moving
```

### Auction

```
Fields:
  currentLimits  : AuctionLimits - Limits based on current/rendered positions
  targetLimits   : AuctionLimits - Limits based on target/server positions
  buyers         : ArrayList<Player>
  sellers        : ArrayList<Player>
  remoteBuyers   : ArrayList<Player>
  remoteSellers  : ArrayList<Player>
  tickSetupLow   : TickSetup(2, 10, 40, 1)  - For food/energy/smithore
  tickSetupHigh  : TickSetup(2, 10, 40, 4)  - For crystite
```

### AbstractAuctionPhase Transaction State

```
Fields:
  tradingBuyers    : ArrayList<Integer>  - User numbers of buyers in current trade
  tradingSellers   : ArrayList<Integer>  - User numbers of sellers in current trade
  tradeTick        : int                 - The tick at which the current trade is happening
  tradersLocked    : boolean             - Whether traders are locked into the trade
  transactionTime  : long                - Timestamp when next unit should trade
  unitsTraded      : int                 - Units traded in current meeting
  tradeCooldown    : long                - Cooldown after breaking a trade
  totalUnitsTraded : int                 - Total units traded this auction
  totalUnitsPrice  : int                 - Total price of all units this auction
  startedTransaction : boolean           - Whether BeginTransactionMessage was sent
  storeClosed      : boolean             - Whether store has run out
```

---

## Appendix: Network Synchronization

The auction uses a dual-state system for network play:

- **currentLimits** / **auctionState**: The rendered, interpolated state
- **targetLimits** / **targetAuctionState**: The authoritative server state

Server sends `TotalAuctionStateMessage` (all player states) via UDP every 4 frames.
Clients send `PlayerAuctionStateMessage` (their own state) via UDP every 4 frames.

Transactions are synchronized via TCP with a `transactionCount` that all players must acknowledge before the next unit can trade. The `readyForTransaction()` check ensures all players have processed the current transaction before the next one fires.

The `teleportCount` mechanism handles server-side position corrections (when a player is forced to a new position due to running out of money, selling all goods, etc.). Client-side state with an outdated teleport count is ignored.

---

## Appendix: Complete State Machine

```
[begin]
  |
  v
[Declaration Phase]  (6s total: 3s choose + 3s countdown)
  |  Players press UP (sell) or DOWN (buy)
  |  Auto-assigned based on surplus/shortage
  v
[introTimer]  (~1s, compensates for network delay)
  |
  v
[StartAuctionMessage]
  |  Sets final buyer/seller lists
  |  If no goods for sale -> skip to outro
  v
[Trading Phase]  (10s effective timer, slowed during movement/transactions)
  |  Players move up/down to set prices
  |  When buyer tick == seller tick -> transaction begins
  |  Timer pauses during active transactions
  |  Timer runs at 10% speed during player movement
  |  Timer resumes 300ms after all movement stops
  |  Store closed detection expands range when store exhausted
  v
[auctionFinished]
  |
  v
[outroTimer]  (3s)
  |  Average price recorded
  v
[end]
  |  Transition to next collection/auction or summary
```
