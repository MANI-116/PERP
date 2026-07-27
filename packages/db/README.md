# `@repo/db`

Prisma schema, migrations, and the shared PostgreSQL client used by PerpX services.

## Data ownership

PostgreSQL stores users, markets, order/fill projections, and engine recovery snapshots. The live orderbook, collateral, and positions remain authoritative in the engine process; database records are not used for synchronous matching decisions.

## Setup

Set `DATABASE_URL`, then apply committed migrations from the repository root:

```bash
cd packages/db
bun --bun prisma migrate deploy
```

For local schema iteration only, use Prisma's development migration workflow and commit the generated migration. Do not alter existing applied migrations.

## Recovery data

`Snapshot` records contain the serialized engine snapshot, its checksum/version, engine event ID, liquidation counters, and Redis stream ID. The projector retains the newest ten records.
