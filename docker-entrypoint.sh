#!/bin/sh
# docker-entrypoint.sh — starts all backend services in a single container
# Uses Bun as the process launcher for all 5 services.

set -e

echo "Starting PerpX services..."

# Generate Prisma client if needed
cd /app/packages/db
bun run prisma generate 2>/dev/null || true
cd /app

# Start services in background
bun run apps/markPricePoller/index.ts &
echo "[OK] markPricePoller"

bun run apps/engine/index.ts &
echo "[OK] engine"

bun run apps/dbPoller/index.ts &
echo "[OK] dbPoller"

bun run apps/wsServer/index.ts &
echo "[OK] wsServer"

# Start backend in foreground (container stays alive)
exec bun run apps/backend/index.ts
