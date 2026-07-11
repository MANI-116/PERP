#!/bin/sh
set -e

echo "Starting PerpX services..."

# Generate Prisma client at runtime using the injected DATABASE_URL secret
cd /app/packages/db
bunx prisma generate > /dev/null 2>&1
cd /app

bun run apps/markPricePoller/index.ts &
echo "[OK] markPricePoller"

bun run apps/engine/index.ts &
echo "[OK] engine"

bun run apps/dbPoller/index.ts &
echo "[OK] dbPoller"

bun run apps/wsServer/index.ts &
echo "[OK] wsServer"

exec bun run apps/backend/index.ts
