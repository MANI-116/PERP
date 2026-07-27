# PerpX

PerpX is an event-driven perpetual futures exchange prototype built with Bun and TypeScript. It combines an in-memory, FIFO matching engine with Redis Streams, PostgreSQL projections, and WebSocket orderbook delivery.

> **Status: development / educational prototype.** This repository is not suitable for custody, real-money trading, or public production deployment without a security review, operational controls, and further risk-engine hardening.

## Architecture

```text
                 HTTP + JWT                     Redis Streams
Trading UI ─────────────────► Backend ───────────────────────► Engine worker
     ▲                          │                                  │
     │                          │ correlation-based response       │ matching, margin,
     │                          ◄──────────────────────────────────┤ positions, snapshots
     │                                                             ▼
     └──── WebSocket updates ◄── wsServer ◄──── response-stream ── dbPoller
                                                              │         │
                                                              │         └── PostgreSQL
Market-price feed ─────────────────────────────► engine-stream
```

`engine-stream` carries commands into the engine. `response-stream` carries immutable engine responses to independent consumer groups for the REST API, database projector, and WebSocket server.

## What the engine does

- Limit and market order matching with price-time priority.
- Per-price FIFO queues backed by doubly linked lists.
- Available/locked collateral accounting, initial-margin reservation, maker/taker fees, realized PnL, reductions, and position flips.
- Per-market liquidation-price indexes and mark-price-triggered liquidation orders.
- Full in-memory snapshots with schema versioning and SHA-256 checksum validation.

All monetary values inside the engine are `bigint` fixed-point integers. The command adapter currently scales submitted order prices by `100_000_000`; clients must send integer strings and must not use JavaScript floating-point values for money or size.

## Repository layout

| Location | Responsibility |
|---|---|
| `apps/backend` | REST API, JWT authentication, request/response correlation |
| `apps/engine` | Redis command worker, recovery, liquidation orchestration |
| `apps/dbPoller` | Response-stream consumer that writes PostgreSQL projections and snapshots |
| `apps/wsServer` | WebSocket subscriptions and incremental depth fan-out |
| `apps/markPricePoller` | External mark-price feed adapter |
| `apps/frontend/perpx-frontend` | Next.js trading interface |
| `packages/engine` | Deterministic matching, book, user, market, and position structures |
| `packages/types` | Shared command/event contracts |
| `packages/db` | Prisma client and database schema |

## Prerequisites

- Bun 1.3+
- Docker and Docker Compose
- PostgreSQL 16 and Redis 7 (the supplied Compose file provides both)

Create a local environment file with values appropriate to your environment:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/perps
REDIS_URL=redis://localhost:6379
JWT_PASS=replace-with-a-long-random-secret
PORT=3001
NEXT_PUBLIC_API_BASE=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:8080
# Required only when running the mark-price poller
BINANCE_URL=wss://<your-mark-price-stream>
```

## Local development

```bash
bun install
docker compose up -d

cd packages/db && bun --bun prisma migrate deploy && cd ../..

# Start each long-running service in a separate terminal.
bun run engine
bun run db-poller
bun run wss
bun run backend

cd apps/frontend/perpx-frontend && bun run dev
```

Start the engine before submitting commands. The provided reset/seed helper can clear local infrastructure and enqueue seed commands:

```bash
bun run reset
```

## Service runbook

| Service | Command | Default endpoint |
|---|---|---|
| Backend | `bun run backend` | `http://localhost:3001` when `PORT=3001` |
| Engine | `bun run engine` | Redis consumer |
| Database projector | `bun run db-poller` | Redis consumer |
| WebSocket server | `bun run wss` | `ws://localhost:8080` |
| Recovery helper | `bun run recover` | Sends `RESTORE_SNAPSHOT` command |

See each service directory for operational detail.

## API overview

Authenticated routes use the `Authorization` JWT cookie created by `POST /signin`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/signup` | Create a database user and engine user |
| `POST` | `/signin` | Authenticate and set JWT cookie |
| `POST` | `/admin/market` | Create a market and enqueue engine creation |
| `POST` | `/onramp` | Credit test collateral |
| `POST` | `/order` | Submit a limit or market order |
| `DELETE` | `/order` | Cancel a resting order |
| `GET` | `/depth/:marketId` | Fetch a depth snapshot and sequence ID |
| `GET` | `/positions/open/:marketId` | Fetch engine positions |
| `GET` | `/orders/:marketId` | Fetch persisted order history |
| `GET` | `/fills` | Fetch persisted fill history |

Example limit-order body:

```json
{
  "type": "LIMIT",
  "marketId": "<market-id>",
  "side": "LONG",
  "leverage": "5",
  "qty": "2",
  "price": "65000"
}
```

The authenticated user ID is injected by middleware; do not rely on a client-supplied user ID.

## WebSocket depth protocol

Connect to the WebSocket server and send:

```json
{ "type": "subscribe", "marketId": "<market-id>" }
```

Depth changes arrive as:

```json
{
  "type": "update",
  "data": {
    "uid": 42,
    "bids": [["6490000000000", "3"]],
    "asks": [["6500000000000", "0"]]
  }
}
```

Clients should bootstrap from `GET /depth/:marketId`, track `uid`, apply deltas in order, and resubscribe/refetch if a sequence gap is detected. A quantity of `"0"` removes a level.

## Recovery and data consistency

The engine emits a snapshot every five minutes and on `SIGINT`/`SIGTERM`. A snapshot includes user state, markets, books, positions, engine event ID, liquidation counters, a schema version, and checksum. `dbPoller` stores snapshots in PostgreSQL; the engine restores the newest valid snapshot at startup and replays later Redis commands.

Redis Streams provide at-least-once delivery. Consumers must remain idempotent: engine responses include a monotonic `eventId`, and WebSocket/API consumers use it to reject duplicates. Monitor consumer-group pending entries, stream growth, snapshot age, engine restart logs, and projector errors.

## Verification

```bash
bun test apps/tests/
bun test apps/tests/structuresTests/engine.test.ts
bun test apps/tests/integration.test.ts
```

## Current limitations

- This is not a production financial system: no custody, KYC/AML, rate limiting, authorization model for privileged routes, audit controls, or formal risk limits.
- ADL and funding-rate settlement are not complete workflows.
- Matching is single-process and price indexes are array-backed; horizontal engine scaling requires explicit partitioning and sequencing.
- PostgreSQL is a projection/recovery store, not the matching engine's synchronous source of truth.

## License

MIT
