# Planet M.U.L.E. Timing Reference

Decompiled from Planet M.U.L.E. v1.3.6 (com.turborilla.mule.Properties)

## Land Grant Phase
| Constant | Value | Description |
|----------|-------|-------------|
| landGrantCountdown | 4.0s | Countdown before cursor starts |
| landGrantPlotDuration | 18 frames | Time cursor stays on each plot |
| landGrantGraceFrames | 6 | Grace frames after claim |
| landGrantMinGraceDuration | 10 | Min grace duration |
| landGrantClaimDuration | 80 | Claim animation duration |
| landGrantLockupTime | 600 | Lockup time |
| landGrantOutro | 3.5s | Outro animation |

## Land Rush (Auction)
| Constant | Value | Description |
|----------|-------|-------------|
| landRushPause | 2.0s | Pause before rush |
| landRushCountdown | 4.0s | Countdown |
| landRushTime | 25.0s | Rush duration |
| landRushClaimWait | 1.5s | Wait after claim |
| landAuctionTime | 34.25s | Total land auction duration |
| landAuctionNoSaleTime | 5.0s | Time shown when no sale |
| landAuctionPauseTime | 1.0s | Pause between auctions |
| landAuctionSellBlinks | 4 | Blink count on sell |
| landAuctionShowBuyTime | 4.75s | Show buy result |
| landAuctionShowNoBuyTime | 0.8s | Show no buy |
| landAuctionStopWalkTime | 0.2s | Walk stop time |
| landAuctionStopSlowdown | 1.5f | Walk slowdown |
| landAuctionTimerFastSpeed | 3.0f | Fast timer speed |
| landAuctionPrice | 160 | Starting price |
| landAuctionPriceRange | 140 | Price range |

## Development Phase
| Constant | Value | Description |
|----------|-------|-------------|
| developmentCountdown | 4.0s | Countdown before turn |
| developmentOutro | 2.0s | Outro after turn |
| minDevelopmentTime | 5.0s | Min turn time (no food) |
| maxDevelopmentTime | 47.5s | Max turn time (full food) |
| buyTimeDuration | 20.0s | Time to buy in store? |
| outfitMuleTime | 2.75s | Time to outfit M.U.L.E. |
| assayTime | 2.5s | Time for assay result |
| developmentMessageLife | 5.0s | Message display time |
| sendAvatarCommandsInterval | 8ms | Avatar command send rate |

## Food Requirements (per round)
```
[0, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
```

## Pub Payouts (per round)
```
[0, 50, 50, 50, 100, 100, 100, 100, 150, 150, 150, 150, 200]
pubMaxRandomAmount = 200
```

## Production Phase
| Constant | Value | Description |
|----------|-------|-------------|
| productionPowerTime | 2.0s | Power plant animation |
| productionStartProduceTime | 2.6s | Start production delay |
| produceTimeMin | 0.3s | Min produce animation |
| produceTimeMax | 0.5s | Max produce animation |
| productionResultTime | 9.0s | Result display |
| maxProduction | 8 | Max units per M.U.L.E. |
| spoilageBlinkTime | 0.5s | Spoilage blink |
| previousUnitsTime | 2.5s | Show previous units |
| usageTime | 1.0s | Show usage |
| currentUnitsTime | 2.5s | Show current units |
| spoilageTime | 1.0s | Show spoilage |
| intermediateUnitsTime | 2.5s | Show intermediate |
| collectionTime | 1.0s | Collection animation |
| resultUnitsTime | 4.0s | Show result units |
| collectionEndTime | 5.0s | End of collection |

## Trading Auction Phase
| Constant | Value | Description |
|----------|-------|-------------|
| auctionCountdownTime | 3.0s | Declaration countdown |
| auctionTime | 10.0s | Auction trading time |
| auctionSpeed | 3 | Player movement speed |
| auctionTimerSlowSpeed | 0.1f | Slow timer speed |
| auctionTimeSpeedUpDelay | 300ms | Speed up delay |
| sendAuctionStateInterval | 4 | State send interval |
| skipAuctionTime | 4.0s | Skip display time |
| noGoodsForSaleTime | 4.0s | No goods display |
| transactionTimeStart | 225 | Initial transaction time (ms?) |
| transactionTime | 650 | Base transaction time |
| transactionTimeDecrease | 75 | Speed up per trade |
| transactionMinTime | 125 | Min transaction time |
| transactionGraceTime | 160 | Grace after trade |
| transactionGraceDecrease | 40 | Grace speed up |
| transactionGraceMin | 80 | Min grace time |
| transactionMaxPitch | 1.3f | Sound pitch increase |

## Equipment Costs
| Resource | Cost |
|----------|------|
| Food | $25 |
| Energy | $50 |
| Smithore | $75 |
| Crystite | $100 |

## Production Quality by Terrain
| Terrain | Food | Energy | Smithore |
|---------|------|--------|----------|
| water (river) | 4 | 2 | 0 |
| smallWater | ? | ? | 1 |
| desert (plains) | 0 | 4 | 1 |
| mountain1 | 1 | 1 | 2 |
| mountain2 | 1 | 1 | 3 |
| mountain3 | 1 | 1 | 4 |

## Store Price Ranges
| Resource | Range |
|----------|-------|
| Food | 35 |
| Energy | 35 |
| Smithore | 35 |
| Crystite | 140 |
| Crystite deviance | 100 |

## Energy Requirements
- Food M.U.L.E.: 0 energy per round (food doesn't need energy?)
- Smithore M.U.L.E.: 1 energy per round
- Crystite M.U.L.E.: 1 energy per round

## Scoring
- pointsPerLand: 500
- pointsPerMule: 35

## Miscellaneous
| Constant | Value |
|----------|-------|
| defaultRaceSpeed | 80 |
| hirlingSpeed | 60 |
| matchmakingOutroTime | 2.0s |
| humanoidBonusProbability | 25% |
| globalBlinksPerSecond | 0.75 |
| maxNumPlayers | 4 |
| SERVER_TCP_PORT | 6260 |
