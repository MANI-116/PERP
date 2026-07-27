# `@repo/engine-package`

The deterministic, in-memory domain core for PerpX. This package has no Redis, HTTP, Prisma, or WebSocket dependency: callers submit typed commands and receive typed engine responses.

## Responsibilities

- Orderbook matching and price-time priority.
- User collateral and locked-margin accounting.
- Position lifecycle: open, increase, reduce, close, and flip.
- Fee accounting, realized PnL, and exchange bankruptcy balance.
- Liquidation-price indexes.
- Snapshot serialization and validated restoration.

## Main model

`Engine` owns singleton `UserManager` and `MarketManager` instances. A `Market` owns an `OrderBook` plus long/short positions grouped by liquidation price. A price level stores FIFO nodes in `Dll`; order and position reference maps permit direct lookup.

```text
Engine → MarketManager → Market → OrderBook → price level → FIFO linked list
      └→ UserManager → User collateral + marketId → positionId map
```

## Matching lifecycle

1. `Engine.placeOrder` validates the request and reserves required margin.
2. A limit order crosses eligible opposite-side price levels; a market order walks all available opposite-side levels.
3. At each level, resting orders execute FIFO. Self matches are skipped.
4. Every fill updates maker and taker positions separately.
5. Unused reserved collateral is released; the caller receives fills and depth deltas.

`totalQty` is the **remaining executable quantity** at a price level. Any change to matcher or cancellation logic must preserve this invariant and never decrement a filled order twice.

## Numeric convention

Use `bigint` exclusively for quantity, price, collateral, margin, fees, and PnL. Transport-boundary code is responsible for parsing strings and applying price scale.

## Snapshots

`Engine.getSnapshot()` emits a versioned envelope containing a SHA-256 checksum over serialized core state. `Engine.createFromSnapshot()` validates envelope shape, version compatibility, checksum, and nested snapshots before reconstructing reference maps.

## Tests

From the repository root:

```bash
bun test apps/tests/structuresTests/
bun test apps/tests/scenarios/
```

Keep scenario coverage for FIFO, partial fills, multi-level sweeps, cancellation, margin release, position reductions/flips, and snapshot restore whenever changing this package.
