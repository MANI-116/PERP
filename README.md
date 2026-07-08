# PerpX — Centralized Perpetual Futures Exchange

A real-time perpetual futures exchange built from scratch. Features a custom FIFO order matching engine, WebSocket streaming orderbook, Redis event-driven architecture, and crash recovery with snapshot validation.

## Features

- **Order Matching Engine** — FIFO price-time priority with custom balanced BST + doubly-linked list data structures
- **Order Types** — Limit and Market orders with full/partial fill, multi-level sweeps
- **Position Management** — Same-side increase, opposite-side reduce, position flip, margin calculations
- **Liquidation Engine** — Real-time mark price monitoring, auto-liquidation with bankruptcy/ADL path
- **Leverage Trading** — Configurable leverage with initial and maintenance margin tracking
- **Real-time Orderbook** — WebSocket streaming with cumulative depth visualization
- **Crash Recovery** — Periodic state snapshots with SHA-256 checksum validation, auto-recovery on restart
- **Event-driven** — Redis Streams message bus with consumer groups for reliable delivery
- **Idempotency** — Monotonic event IDs ensure downstream services process each event exactly once
- **Web UI** — Next.js 16 + React 19 + Tailwind CSS 4 + Framer Motion

## Architecture

```
┌─────────────┐     ┌─────────────────────────────────────┐
│  Frontend   │     │            Backend                   │
│  Next.js 16 │────▶│  Express REST + JWT Auth             │
│  React 19   │     │  Zod Validation                      │
│  Tailwind 4 │     │  ResponseManager (Redis producer)    │
└──────┬──────┘     └──────────────┬───────────────────────┘
       │                           │
       │ HTTP                      │ Redis Streams (engine-stream)
       ▼                           ▼
┌──────────────┐     ┌─────────────────────────────────────┐
│  wsServer    │     │           Engine                     │
│  Port 8080   │     │  In-memory Matching Engine           │
│  WebSocket   │     │  FIFO Price-Time Priority            │
│  Per-market  │     │  Position/Margin Tracking            │
│  subscribers │     │  Liquidation Engine                  │
└──────┬───────┘     │  Funding Rate Engine (WIP)           │
       │             └──────────────┬───────────────────────┘
       │                            │
       │ Redis Streams              │ Redis Streams (response-stream)
       │ (response-stream)          │
       │                            ▼
       │             ┌──────────────────────────────┐
       ├────────────▶│        dbPoller              │
       │             │  Reads response-stream        │
       │             │  Persists to PostgreSQL       │
       │             │  Snapshot management           │
       │             └──────────────────────────────┘
       │
       ▼
┌──────────────────┐
│  Orderbook UI     │
│  Real-time depth  │
│  Cumulative bars  │
└──────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | **Bun** 1.3 |
| Language | **TypeScript** 5.x |
| Backend | **Express** 5.x |
| Matching Engine | Custom (BST + DLL + PriceLevel) |
| Message Bus | **Redis** 7 (Streams + Consumer Groups) |
| Database | **PostgreSQL** 16 + **Prisma** 7 |
| Frontend | **Next.js** 16 + **React** 19 + **Tailwind CSS** 4 |
| Animations | **Framer Motion** (motion) |
| WebSocket | **ws** (server) + Native WebSocket (client) |
| Auth | **JWT** + **bcrypt** (Bun.password) |

## Project Structure

```
├── apps/
│   ├── backend/          Express REST API (port 3001)
│   ├── engine/           In-memory order matching engine
│   ├── wsServer/         WebSocket server (port 8080)
│   ├── dbPoller/         Redis → PostgreSQL persistence
│   ├── markPricePoller/  Binance WebSocket oracle
│   ├── frontend/         Next.js trading UI
│   └── tests/            208+ unit & integration tests
├── packages/
│   ├── types/            Shared TypeScript types
│   ├── engine/           Core matching engine structures
│   └── db/               Prisma schema & client
├── scripts/
│   ├── recover-engine.ts Crash recovery script
│   └── seed-engine.ts    Bootstrap engine from DB
└── docker-compose.yml    PostgreSQL 16 + Redis 7
```

## Getting Started

```bash
# 1. Install dependencies
bun install

# 2. Start infrastructure
docker compose up -d

# 3. Run database migrations
cd packages/db && bun --bun prisma migrate deploy && cd ../..

# 4. Start services (each in its own terminal)
bun run engine
bun run db-poller
bun run wss
bun run backend

# 5. Start frontend
cd apps/frontend/perpx-frontend && bun run dev

# 6. Seed markets via API
curl -X POST http://localhost:3001/admin/market \
  -H "Content-Type: application/json" \
  -d '{"name":"Bitcoin Perp","symbol":"BTC-PERP","slug":"btc-perp","scale":"8","markPrice":"65000000000","takerRate":"10","makerRate":"5","mmr":"50"}'
```

Repeat for other markets (ETH-PERP, SOL-PERP, XRP-PERP, DOGE-PERP, BNB-PERP).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/signup` | No | Register user |
| POST | `/signin` | No | Login (JWT cookie) |
| POST | `/admin/market` | No | Create market |
| POST | `/onramp` | JWT | Credit user funds |
| POST | `/order` | JWT | Place limit/market order |
| DELETE | `/order` | JWT | Cancel order |
| GET | `/markets` | No | List all markets |
| GET | `/depth/:marketId` | JWT | Orderbook depth snapshot |
| GET | `/orders/open/:marketId` | JWT | Open orders |
| GET | `/positions/open/:marketId` | JWT | Open positions |
| GET | `/positions/closed/:marketId` | JWT | Closed positions |
| GET | `/equity/available` | JWT | User equity |
| GET | `/fills` | JWT | User fills |

## Tests

```bash
# Run all tests (208 passing)
bun test apps/tests/

# Engine-specific tests
bun test:engine

# Integration tests
bun test:integration
```

## Key Design Decisions

**In-memory engine** — All orderbook, position, and user state lives in memory for matching latency. Snapshots persist to PostgreSQL via the dbPoller for crash recovery.

**Event sourcing via Redis Streams** — Every state change is an immutable event. Consumers (dbPoller, wsServer, Backend) each have their own consumer group with independent ACK tracking.

**Idempotent event processing** — Every engine-outgoing event includes a monotonic `eventId`. Downstream services compare against their last processed ID and skip duplicates, making replay safe.

**Crash recovery** — Periodic snapshots are SHA-256 checksummed and versioned. On restart, the engine loads the latest snapshot from Redis, replays missed messages via XRANGE, and resumes normal processing.

## License

MIT
