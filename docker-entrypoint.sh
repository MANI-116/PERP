#!/bin/sh
echo "Starting PerpX services..."

cd /app/packages/db
bunx prisma generate > /dev/null 2>&1 || true
bunx prisma migrate deploy 2>&1 || true
cd /app

bun run apps/markPricePoller/index.ts &
echo "[OK] markPricePoller"
sleep 1
bun run apps/engine/index.ts &
echo "[OK] engine"
sleep 1
bun run apps/dbPoller/index.ts &
echo "[OK] dbPoller"
sleep 1
bun run apps/wsServer/index.ts &
echo "[OK] wsServer"
sleep 1

exec bun run apps/backend/index.ts
