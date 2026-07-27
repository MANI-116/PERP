# Engine worker

The engine worker is the sole writer of live exchange state. It consumes commands from Redis `engine-stream`, invokes `@repo/engine-package`, and appends results to `response-stream`.

## Run

```bash
REDIS_URL=redis://localhost:6379 DATABASE_URL=postgresql://... bun run apps/engine/index.ts
```

Required environment variables: `REDIS_URL`, `DATABASE_URL`. The database connection is used to locate recovery snapshots.

## Command flow

```text
engine-stream → engine-group / engine consumer → engineManager → core Engine
                                                             ↓
response-stream ← serialized EngineResponse ←───────────────┘
```

`engineManager.ts` is the transport adapter. It parses JSON command payloads, converts numeric strings to `bigint`, and dispatches `CREATE_ORDER`, `CREATE_USER`, `CREATE_MARKET`, `RAMP_USER`, queries, cancellation, mark-price updates, and snapshot restore commands.

## Recovery

At startup the worker loads the most recent snapshot from PostgreSQL, validates it through the core engine, then replays commands after the snapshot's recorded Redis stream ID. It also emits a snapshot every five minutes and during graceful `SIGINT`/`SIGTERM` shutdown.

Use `bun run recover` only when an operator intentionally wants to enqueue a `RESTORE_SNAPSHOT` command. Inspect the selected snapshot's checksum, age, and stream ID first.

## Operational checks

- Verify this process has exactly one active consumer for a given matching partition.
- Watch `engine-group` pending messages and Redis stream size.
- Alert on snapshot failures, restore validation failures, and any unhandled command error.
- Drain gracefully: send `SIGTERM` and wait for the final snapshot log before stopping infrastructure.

## Liquidation

`liquidationEngine.ts` scans liquidation-price buckets after a mark-price command and enqueues opposite-side market orders. Generated liquidation commands carry a market-local monotonic `liquidationId`, which the core engine uses as replay protection.
