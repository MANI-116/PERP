# Database projector

`dbPoller` consumes `response-stream` as the `dbPoller` Redis consumer group and materializes engine events in PostgreSQL.

## Run

```bash
REDIS_URL=redis://localhost:6379 DATABASE_URL=postgresql://... bun run apps/dbPoller/index.ts
```

## Projections

| Event | Persistence action |
|---|---|
| `ORDER_ACCEPTED`, `ORDER_REJECTED` | Create order projection |
| `ORDER_FILLED`, `ORDER_FILLED_PARTIALLY` | Update taker/maker orders, create transaction rows, update market last price |
| `DELETE_ORDER` | Mark persisted order closed |
| `SNAPSHOT` | Store validated engine snapshot and retain the latest ten |

## Operations

Start this service before relying on order history, fill history, or crash recovery. Monitor its Redis pending-entry count, PostgreSQL errors, projection lag, and timestamp of the most recent snapshot. A replay-safe projector must treat repeated events as idempotent; preserve that property whenever changing schema or event handling.

The database is a projection/recovery store. Do not attempt to repair a live orderbook by editing order rows manually.
