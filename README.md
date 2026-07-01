# Perpetual Futures Exchange

A full-stack **centralized perpetual futures exchange** built as a Bun monorepo. Features a custom order-matching engine with FIFO price-time priority, position management with leverage, liquidation engine, funding rate mechanism, and real-time WebSocket streaming.

## Architecture

```
Frontend (Next.js)
    ↓ HTTP / WebSocket
Backend (Express REST API)
    ↓ Redis Streams (engine-stream)
Engine (Order Matching + Position Management)
    ↓ Redis Streams (response-stream)
    ├── Backend (responses to HTTP requests)
    ├── dbPoller (persist to PostgreSQL via Prisma)
    └── wsServer (push to WebSocket clients)

Mark Price Poller (Binance WS)
    ↓ Redis Streams (engine-stream)
Engine → Liquidation Engine → Engine (liquidation orders)
```

## Services

| App | Directory | Port | Role |
|---|---|---|---|
| Backend | `apps/backend` | 3000 | REST API — signup, orders, depth, positions |
| Engine | `apps/engine` | — | Order matching engine (Redis consumer) |
| Liquidation Engine | `apps/liquidationEngine` | — | Auto-liquidates underwater positions |
| Funding Rate | `apps/fundingRate` | — | Periodic funding payments |
| Mark Price Poller | `apps/markPricePoller` | — | Binance WebSocket oracle |
| DB Poller | `apps/dbPoller` | — | Persists orders & fills to Postgres |
| WebSocket Server | `apps/wsServer` | — | Real-time orderbook + position updates |
| Frontend | `apps/frontend` | — | Next.js trading UI |
| Tests | `apps/tests` | — | Engine test scenarios |

## Packages

| Package | Directory | Purpose |
|---|---|---|
| `@repo/types` | `packages/types` | Shared domain types & events |
| `@repo/db` | `packages/db` | Prisma schema & DB client |
| `@repo/engine-package` | `packages/engine-package` | Core matching engine, orderbook, position logic |

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Language:** TypeScript
- **Backend:** Express
- **Database:** PostgreSQL + Prisma
- **Cache/Streams:** Redis Streams
- **Frontend:** Next.js, Tailwind CSS, Framer Motion
- **WebSocket:** `ws` (server-side), native WebSocket (client)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- PostgreSQL
- Redis

### Setup

```bash
# Install dependencies
bun install

# Set up database
cd packages/db
bun prisma migrate dev
cd ../..

# Configure environment
cp .env.example .env
# Edit .env with your Postgres/Redis connection strings
```

### Running

Start all services (each in its own terminal):

```bash
# Engine (order matching)
bun run apps/engine/index.ts

# Backend API
bun run apps/backend/index.ts

# WebSocket server
bun run apps/wsServer/index.ts

# DB persistence
bun run apps/dbPoller/index.ts

# Mark price oracle
bun run apps/markPricePoller/index.ts

# Liquidation engine
bun run apps/liquidationEngine/index.ts

# Funding rate engine
bun run apps/fundingRate/index.ts

# Frontend
cd apps/frontend && bun dev
```

### Running Tests

```bash
bun run apps/tests/index.ts
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/signup` | Register a user |
| POST | `/signin` | Login (JWT cookie) |
| POST | `/admin/market` | Create a market |
| POST | `/onramp` | Credit user funds |
| POST | `/order` | Place limit/market order |
| DELETE | `/order` | Cancel an order |
| GET | `/orders/:marketId` | List user orders |
| GET | `/fills` | List user fills |
| GET | `/depth/:marketId` | Get orderbook depth |
| GET | `/positions/open/:marketId` | Open positions |
| GET | `/equity/available` | User available equity |

## Key Concepts

- **Leverage trading** — long/short with configurable leverage
- **Limit & market orders** — limit orders rest on the book, market orders sweep
- **FIFO matching** — price-time priority at each price level
- **Margin system** — initial margin locked on order, maintenance margin for liquidation
- **Liquidation** — auto-triggered when mark price crosses liquidation price
- **Funding rate** — periodic payments between long and short positions
- **Crash recovery** — full state snapshots for engine, markets, and users
