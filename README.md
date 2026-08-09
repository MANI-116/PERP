# PerpX

### Event-Driven Perpetual Futures Exchange

PerpX is a **perpetual futures exchange prototype** built to explore the architecture and engineering problems behind realtime trading systems.

It combines a **deterministic in-memory matching engine**, **Redis Streams**, **PostgreSQL**, **WebSockets**, and a **Next.js trading client** to implement the complete lifecycle of an order:

**Request → Command → Matching → Engine Event → HTTP Response + Persistence + Realtime Update**

The project focuses on the engineering problems underneath a trading platform: **state ownership, deterministic matching, asynchronous processing, margin management, liquidation, event propagation, idempotency, snapshots, and crash recovery.**

> **Status:** Development / Educational Prototype
> PerpX is not production-ready for real-money trading, custody, or public financial use.

---

# Architecture

The system is organized around one core principle:

> **The matching engine owns authoritative trading state. Everything outside the engine interacts with that state through commands and events.**

```mermaid
flowchart LR

    CLIENT["Next.js / React<br/>Trading Client"]

    API["Backend API<br/>Node.js + TypeScript<br/>Non-blocking I/O"]

    CMD[("Redis Stream<br/>engine-stream")]

    ENGINE["Matching Engine<br/>Deterministic In-Memory State"]

    RESP[("Redis Stream<br/>response-stream")]

    CORR["Backend Response Consumer<br/>Correlation ID Resolution"]

    DBP["DB Poller<br/>Projection Consumer"]

    DB[("PostgreSQL")]

    WSS["WebSocket Server<br/>Realtime Consumer"]

    PRICE["External Market Data"]
    MPP["Mark Price Poller"]

    SNAP[("Engine Snapshots")]

    CLIENT -->|"HTTP Request"| API

    API -->|"Command + correlationId"| CMD

    CMD -->|"Consume"| ENGINE

    ENGINE -->|"Engine Event + correlationId"| RESP

    RESP --> CORR
    CORR -->|"Resolve pending request"| API
    API -->|"HTTP Response"| CLIENT

    RESP --> DBP
    DBP -->|"Persist projections"| DB

    RESP --> WSS
    WSS -->|"Realtime updates"| CLIENT

    PRICE --> MPP
    MPP -->|"Price command"| CMD

    ENGINE -->|"Periodic snapshots"| SNAP
```

---

# Why the Backend Does Not Block

An important part of the architecture is the asynchronous request lifecycle.

When a client submits an order, the backend does **not** synchronously wait for the matching engine.

Instead:

```text
Client
   │
   │ POST /order
   ▼
Backend
   │
   ├── validate request
   ├── generate correlationId
   ├── register pending request
   └── publish command
             │
             ▼
       Redis Stream
             │
             ▼
      Matching Engine
```

The Node.js event loop is free to process other requests while the engine processes the command.

When the engine produces the response:

```text
Matching Engine
       │
       ▼
response-stream
       │
       ▼
Backend Response Consumer
       │
       │ correlationId
       ▼
Pending Request
       │
       ▼
HTTP Response
       │
       ▼
Next.js Client
```

This allows the API layer to handle many concurrent requests without maintaining a blocking connection to the engine.

---

# Complete Order Lifecycle

```mermaid
sequenceDiagram
    autonumber

    participant C as Next.js Client
    participant B as Backend API
    participant R as Redis Streams
    participant E as Matching Engine
    participant P as DB Poller
    participant W as WebSocket Server
    participant DB as PostgreSQL

    C->>B: POST /order

    B->>B: Authenticate + Validate
    B->>B: Generate correlationId
    B->>B: Register pending request

    B->>R: Publish command

    Note over B: Request remains pending<br/>without blocking Node.js event loop

    R->>E: Consume command

    E->>E: Validate engine state
    E->>E: Match order
    E->>E: Update balances
    E->>E: Update positions
    E->>E: Calculate PnL / fees

    E->>R: Publish engine response

    par HTTP Response
        R->>B: Consume response
        B->>B: Match correlationId
        B-->>C: HTTP response
    and Persistence
        R->>P: Consume response
        P->>DB: Persist projection
    and Realtime Delivery
        R->>W: Consume response
        W-->>C: WebSocket update
    end
```

The same engine event can therefore serve multiple purposes without coupling the engine directly to HTTP, PostgreSQL, or WebSocket infrastructure.

---

# System Components

| Component                     | Responsibility                                                             |
| ----------------------------- | -------------------------------------------------------------------------- |
| **Next.js Client**            | Trading interface, orderbook, orders, positions                            |
| **Backend API**               | Authentication, request validation, command creation, response correlation |
| **engine-stream**             | Delivers commands to the matching engine                                   |
| **Matching Engine**           | Owns authoritative trading state and executes trades                       |
| **response-stream**           | Publishes engine events/results                                            |
| **Backend Response Consumer** | Matches engine responses with pending HTTP requests                        |
| **DB Poller**                 | Projects engine events into PostgreSQL                                     |
| **WebSocket Server**          | Delivers realtime market updates                                           |
| **Mark Price Poller**         | Converts external market prices into engine updates                        |
| **PostgreSQL**                | Persistent projections, history, and snapshots                             |
| **Snapshot Store**            | Durable engine-state recovery                                              |

---

# Core Design

PerpX separates the system into three conceptual layers:

```text
                    ┌──────────────────────────┐
                    │      Client Layer        │
                    │                          │
                    │ Next.js + WebSocket +    │
                    │ HTTP                     │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │      Application Layer   │
                    │                          │
                    │ Backend API + Correlation│
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │       Engine Layer       │
                    │                          │
                    │ Matching + Positions +   │
                    │ Margin + Liquidation     │
                    └──────────────────────────┘
```

The engine is deliberately isolated from transport and persistence concerns.

---

# Matching Engine

The matching engine is the core of PerpX.

It maintains active exchange state **in memory** and processes commands deterministically.

```mermaid
flowchart TB

    COMMAND["Engine Command"]

    VALIDATION["Command Validation"]

    MARKET["Market Manager"]

    BOOK["Order Book"]

    USERS["User Manager"]

    POSITIONS["Position State"]

    MARGIN["Margin / Collateral"]

    FUNDING["Funding State"]

    LIQUIDATION["Liquidation State"]

    EVENT["Engine Event"]

    COMMAND --> VALIDATION
    VALIDATION --> MARKET

    MARKET --> BOOK
    MARKET --> USERS

    BOOK --> POSITIONS
    USERS --> MARGIN

    POSITIONS --> MARGIN
    MARGIN --> FUNDING
    MARGIN --> LIQUIDATION

    BOOK --> EVENT
    POSITIONS --> EVENT
    MARGIN --> EVENT
    LIQUIDATION --> EVENT
```

### Engine responsibilities

* Limit order matching
* Market order execution
* Price-time priority
* FIFO order queues
* Partial fills
* Order cancellation
* Balance management
* Locked collateral
* Initial margin
* Leverage
* Position management
* Realized PnL
* Position reduction
* Position flips
* Liquidation state
* Snapshot generation
* State restoration

---

# Order Book

The orderbook uses price levels with FIFO ordering inside each level.

```text
                    ORDER BOOK

       BIDS                         ASKS

   64,900 ─── 3.0              65,100 ─── 2.0
   64,800 ─── 5.0              65,200 ─── 4.0
   64,700 ─── 1.5              65,300 ─── 6.0

                     │
                     ▼

             PRICE-TIME PRIORITY
```

Conceptually:

```text
Price Level: 65,000

┌──────────────┐
│ Order A      │  ← oldest
├──────────────┤
│ Order B      │
├──────────────┤
│ Order C      │
└──────────────┘
```

The first eligible order is always matched first.

This makes matching deterministic and simplifies replay during recovery.

---

# Trading State

The engine maintains the state required to safely execute leveraged trades.

```mermaid
flowchart LR

    USER["User"]

    BALANCE["Available Balance"]

    LOCKED["Locked Margin"]

    ORDERS["Open Orders"]

    POSITION["Position"]

    MARK["Mark Price"]

    MARGIN["Margin Calculation"]

    RISK{"Risk Check"}

    NORMAL["Normal"]

    LIQ["Liquidation"]

    USER --> BALANCE
    USER --> LOCKED
    USER --> ORDERS
    USER --> POSITION

    POSITION --> MARGIN
    BALANCE --> MARGIN
    MARK --> MARGIN

    MARGIN --> RISK

    RISK -->|"Healthy"| NORMAL
    RISK -->|"Unsafe"| LIQ
```

---

# Liquidation Flow

Liquidation is driven by position risk relative to the mark price.

```mermaid
flowchart TB

    MARK["Mark Price Update"]

    POSITION["Open Position"]

    RISK["Calculate Position Risk"]

    CHECK{"Liquidation<br/>Threshold?"}

    CONTINUE["Continue Trading"]

    STATE["Set Position<br/>LIQUIDATING"]

    ORDER["Create Liquidation Order"]

    ENGINE["Matching Engine"]

    MARK --> RISK
    POSITION --> RISK

    RISK --> CHECK

    CHECK -->|"No"| CONTINUE
    CHECK -->|"Yes"| STATE

    STATE --> ORDER
    ORDER --> ENGINE
```

The explicit `LIQUIDATING` state prevents normal trading operations from incorrectly modifying a position while its liquidation workflow is active.

---

# Event-Driven Communication

Redis Streams form the communication boundary between services.

```mermaid
flowchart LR

    API["Backend"]

    COMMANDS[("engine-stream")]

    ENGINE["Matching Engine"]

    EVENTS[("response-stream")]

    RESPONSE["Backend Response Consumer"]

    DBP["DB Poller"]

    WSS["WebSocket Server"]

    API -->|"Commands"| COMMANDS

    COMMANDS --> ENGINE

    ENGINE -->|"Events"| EVENTS

    EVENTS --> RESPONSE
    EVENTS --> DBP
    EVENTS --> WSS
```

The important property is that the response stream has **multiple independent consumers**.

```text
                    response-stream
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
          Backend       DB Poller       WSS
             │             │             │
             ▼             ▼             ▼
        HTTP Response  PostgreSQL    WebSocket
             │                           │
             ▼                           ▼
          Client                      Client
```

This prevents the matching engine from becoming tightly coupled to downstream delivery mechanisms.

---

# Persistence Architecture

PostgreSQL is primarily a **projection and persistence layer**.

It is not synchronously queried for every matching operation.

```mermaid
flowchart LR

    ENGINE["Matching Engine"]

    EVENTS[("response-stream")]

    PROJECTOR["DB Poller"]

    ORDERS[("Orders")]

    FILLS[("Fills")]

    POSITIONS[("Positions")]

    SNAPSHOTS[("Snapshots")]

    ENGINE --> EVENTS
    EVENTS --> PROJECTOR

    PROJECTOR --> ORDERS
    PROJECTOR --> FILLS
    PROJECTOR --> POSITIONS
    PROJECTOR --> SNAPSHOTS
```

This lets the engine optimize for deterministic state transitions while PostgreSQL provides durable, queryable data for APIs and historical views.

---

# Realtime Architecture

The WebSocket server consumes engine events independently.

```mermaid
flowchart LR

    ENGINE["Matching Engine"]

    EVENTS[("response-stream")]

    WSS["WebSocket Server"]

    A["Trader A"]
    B["Trader B"]
    C["Trader C"]

    ENGINE --> EVENTS
    EVENTS --> WSS

    WSS --> A
    WSS --> B
    WSS --> C
```

Clients bootstrap their orderbook using HTTP and then consume incremental updates over WebSockets.

A sequence identifier allows clients to detect missed updates.

```text
Initial Snapshot
      │
      ▼
uid = 100
      │
      ├── update 101
      ├── update 102
      ├── update 103
      │
      ▼
Current Orderbook
```

If a client observes:

```text
100 → 101 → 105
```

it knows updates were missed and can resynchronize from a fresh snapshot.

---

# Mark Price Architecture

External market data is isolated from the core matching loop.

```mermaid
flowchart LR

    EXTERNAL["External Market<br/>Data Feed"]

    POLLER["Mark Price Poller"]

    STREAM[("Redis Stream")]

    ENGINE["Matching Engine"]

    POSITIONS["Positions"]

    RISK["Risk / Liquidation"]

    EXTERNAL --> POLLER
    POLLER --> STREAM
    STREAM --> ENGINE

    ENGINE --> POSITIONS
    POSITIONS --> RISK
```

This keeps external network connectivity out of the core engine process.

---

# Recovery Architecture

The engine periodically creates snapshots of its in-memory state.

If the process crashes, the engine restores the latest valid snapshot and replays commands that occurred after that snapshot.

```mermaid
flowchart TB

    SNAP[("Latest Valid Snapshot")]

    STREAM[("Redis Command Stream")]

    RECOVERY["Recovery Manager"]

    RESTORE["Restore Snapshot"]

    REPLAY["Replay Commands<br/>after Snapshot"]

    ENGINE["Matching Engine"]

    LIVE["Resume Live Processing"]

    SNAP --> RECOVERY

    STREAM -->|"Commands after snapshot"| RECOVERY

    RECOVERY --> RESTORE

    RESTORE --> REPLAY

    REPLAY --> ENGINE

    ENGINE --> LIVE
```

---

# Snapshot Lifecycle

```text
             Engine Running
                   │
                   ▼
           Build Engine Snapshot
                   │
                   ▼
          Calculate SHA-256 Checksum
                   │
                   ▼
            Persist Snapshot
                   │
                   ▼
             Engine Continues
                   │
                   X
                CRASH
                   │
                   ▼
          Load Latest Snapshot
                   │
                   ▼
           Validate Checksum
                   │
                   ▼
             Restore State
                   │
                   ▼
            Replay New Events
                   │
                   ▼
           Resume Processing
```

Snapshots contain the state necessary to reconstruct the engine, including:

* users
* balances
* markets
* orderbooks
* positions
* liquidation state
* engine event ID
* liquidation counters
* schema version
* checksum

---

# Consistency Model

PerpX intentionally uses different consistency models for different parts of the system.

| Component                    | Consistency                             |
| ---------------------------- | --------------------------------------- |
| Matching Engine              | Deterministic ordered state transitions |
| Redis Streams                | At-least-once delivery                  |
| Backend response correlation | Correlation-based request resolution    |
| PostgreSQL                   | Eventually consistent projection        |
| WebSocket                    | Ordered incremental updates with resync |
| Snapshots                    | Durable recovery checkpoints            |

The important distinction is:

> **The engine is authoritative for trading state; downstream systems are derived projections.**

---

# Idempotency

Because Redis Streams provide at-least-once delivery, consumers must tolerate duplicates.

Example:

```text
eventId 100
eventId 101
eventId 102
eventId 102  ← duplicate
eventId 103
```

Consumers can use monotonic event IDs to reject events they have already processed.

This matters during:

* consumer restarts
* replay
* engine recovery
* network failures
* duplicate delivery

The architecture therefore favors:

```text
At-least-once delivery
          +
Idempotent consumers
          =
Recoverable event-driven system
```

---

# Precision and Monetary Values

Trading systems cannot safely depend on JavaScript floating-point arithmetic for monetary state.

PerpX therefore uses:

```text
BigInt
   +
Fixed-point representation
   =
Deterministic financial calculations
```

Prices and monetary values inside the engine are represented as scaled integers.

This avoids common problems such as:

```text
0.1 + 0.2 !== 0.3
```

when values are represented using binary floating-point arithmetic.

Clients should therefore treat monetary values as strings/integers at API boundaries rather than relying on JavaScript `number` precision.

---

# API

| Method   | Endpoint                    | Purpose                |
| -------- | --------------------------- | ---------------------- |
| `POST`   | `/signup`                   | Create user            |
| `POST`   | `/signin`                   | Authenticate user      |
| `POST`   | `/admin/market`             | Create market          |
| `POST`   | `/onramp`                   | Add test collateral    |
| `POST`   | `/order`                    | Submit order           |
| `DELETE` | `/order`                    | Cancel order           |
| `GET`    | `/depth/:marketId`          | Fetch depth snapshot   |
| `GET`    | `/positions/open/:marketId` | Fetch open positions   |
| `GET`    | `/orders/:marketId`         | Fetch persisted orders |
| `GET`    | `/fills`                    | Fetch persisted fills  |

Authenticated routes use the JWT authentication flow.

---

# Example Order

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

The authenticated user identity is obtained from the authentication layer rather than trusting a client-provided user ID.

---

# WebSocket Protocol

Subscribe to a market:

```json
{
  "type": "subscribe",
  "marketId": "<market-id>"
}
```

Example depth update:

```json
{
  "type": "update",
  "data": {
    "uid": 42,
    "bids": [
      ["6490000000000", "3"]
    ],
    "asks": [
      ["6500000000000", "0"]
    ]
  }
}
```

A quantity of `"0"` represents removal of a price level.

---

# Repository Structure

```text
.
├── apps/
│   ├── backend/
│   │   └── REST API, authentication, request correlation
│   │
│   ├── engine/
│   │   └── Engine worker, recovery, liquidation orchestration
│   │
│   ├── dbPoller/
│   │   └── PostgreSQL projection consumer
│   │
│   ├── wsServer/
│   │   └── WebSocket server
│   │
│   ├── markPricePoller/
│   │   └── External market price adapter
│   │
│   └── frontend/
│       └── perpx-frontend/
│           └── Next.js trading application
│
├── packages/
│   ├── engine/
│   │   └── Core matching engine and state structures
│   │
│   ├── types/
│   │   └── Shared commands, events and contracts
│   │
│   └── db/
│       └── Prisma client and database schema
│
└── apps/tests/
    └── Unit and integration tests
```

---

# Technology Stack

| Category       | Technology              |
| -------------- | ----------------------- |
| Language       | TypeScript              |
| Runtime        | Bun / Node.js           |
| Frontend       | Next.js / React         |
| API            | Node.js                 |
| Messaging      | Redis Streams           |
| Database       | PostgreSQL              |
| ORM            | Prisma                  |
| Realtime       | WebSockets              |
| Infrastructure | Docker / Docker Compose |
| Testing        | Bun Test                |

---

# Local Development

## Requirements

* Bun 1.3+
* Docker
* Docker Compose
* PostgreSQL 16
* Redis 7

## Install

```bash
bun install
```

Start infrastructure:

```bash
docker compose up -d
```

Run migrations:

```bash
cd packages/db
bun --bun prisma migrate deploy
cd ../..
```

Start services in separate terminals:

```bash
bun run engine
```

```bash
bun run db-poller
```

```bash
bun run wss
```

```bash
bun run backend
```

Start frontend:

```bash
cd apps/frontend/perpx-frontend
bun run dev
```

---

# Environment Variables

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/perps
REDIS_URL=redis://localhost:6379
JWT_PASS=replace-with-a-long-random-secret

PORT=3001

NEXT_PUBLIC_API_BASE=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:8080

BINANCE_URL=wss://<your-mark-price-stream>
```

---

# Testing

Run the complete test suite:

```bash
bun test apps/tests/
```

Engine tests:

```bash
bun test apps/tests/structuresTests/engine.test.ts
```

Integration tests:

```bash
bun test apps/tests/integration.test.ts
```

---

# Engineering Tradeoffs

## Why an in-memory matching engine?

Order matching requires frequent state mutations and deterministic ordering.

Keeping active trading state in memory avoids making PostgreSQL part of the critical matching path.

**Tradeoff:** memory is volatile, therefore snapshots and replay are required.

---

## Why Redis Streams?

Redis Streams provide a simple event transport with consumer groups and replay capabilities.

They also decouple the engine from API, persistence, and realtime delivery.

**Tradeoff:** delivery is at-least-once, so consumers need idempotency.

---

## Why PostgreSQL projections?

PostgreSQL is excellent for:

* historical orders
* fills
* positions
* user queries
* reporting
* durable storage

But it is not optimized to be synchronously involved in every matching operation.

---

## Why WebSockets?

Trading clients need low-latency incremental market updates.

The WebSocket server can consume engine events independently and fan them out to connected clients without putting socket management inside the matching engine.

---

## Why a single engine?

A single engine provides a straightforward deterministic ordering model.

Horizontal scaling introduces a much harder problem: **who owns the state for a market and who guarantees ordering?**

A future architecture could partition markets:

```text
                 Exchange
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Engine A     Engine B     Engine C
        │           │           │
     BTC-USD      ETH-USD      SOL-USD
```

The partitioning strategy must guarantee that all commands for a given market are processed in order.

---

# Failure Scenarios

### Backend restart

Pending HTTP requests may be lost, but the engine remains independent.

New requests can continue after the backend reconnects.

### DB Poller restart

The engine does not need to stop matching.

The poller can resume consumption and rebuild its projections from events according to the configured recovery strategy.

### WebSocket server restart

Clients reconnect and bootstrap a fresh orderbook snapshot before consuming incremental updates.

### Engine restart

The engine restores its latest valid snapshot and replays subsequent commands before returning to live processing.

---

# Current Limitations

This is a systems-learning project, not a production exchange.

It currently does not provide:

* custody
* KYC / AML
* production authorization controls
* formal security auditing
* production-grade rate limiting
* complete funding settlement
* complete ADL implementation
* distributed engine partitioning
* production disaster recovery
* comprehensive observability
* production financial safeguards

These boundaries are intentional.

---

# Future Work

Potential improvements include:

* market-level engine partitioning
* persistent event log
* stronger recovery guarantees
* funding-rate settlement
* ADL
* advanced risk engine
* load testing
* fault injection
* distributed tracing
* metrics and alerting
* automated deployment
* production authentication and authorization
* stronger durability guarantees

---

# What I Wanted to Learn

The project started as an attempt to understand what actually happens underneath a trading interface.

Instead of treating an exchange as a collection of CRUD APIs, PerpX explores the underlying systems:

```text
                     Trading System

                         Client
                           │
                           ▼
                    Request Handling
                           │
                           ▼
                    Event Transport
                           │
                           ▼
                  Deterministic Engine
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
         Persistence    Realtime      Response
             │             │             │
             ▼             ▼             ▼
         PostgreSQL     WebSocket       HTTP
```

The primary engineering problems explored are:

* deterministic state machines
* event-driven architecture
* asynchronous I/O
* request correlation
* order matching
* margin and position accounting
* liquidation
* realtime data delivery
* idempotent consumers
* snapshotting
* crash recovery
* state reconstruction
* service boundaries
* scaling tradeoffs

---

# Disclaimer

PerpX is an educational software project.

It is **not a financial product**, trading service, brokerage, or production exchange.

Do not use this software with real funds.

---

