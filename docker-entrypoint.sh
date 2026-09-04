#!/bin/sh
echo "Starting PerpX services..."

cd /app/packages/db
bun --bun run prisma generate || exit 1
bun --bun run prisma migrate deploy || exit 1
cd /app

bun run apps/engine/index.ts &
echo "[OK] engine"
sleep 1
bun run apps/dbPoller/index.ts &
echo "[OK] dbPoller"
sleep 1

exec bun run apps/backend/index.ts
