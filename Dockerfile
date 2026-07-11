FROM oven/bun:1.3 AS base
WORKDIR /app

# Install deps (cached layer)
COPY package.json bun.lock ./
COPY packages/ packages/
COPY apps/backend/ apps/backend/
COPY apps/engine/ apps/engine/
COPY apps/wsServer/ apps/wsServer/
COPY apps/dbPoller/ apps/dbPoller/
COPY apps/markPricePoller/ apps/markPricePoller/

RUN bun install --production

# ── Runtime ─────────────────────────────────────────────
FROM oven/bun:1.3 AS runtime
WORKDIR /app

COPY --from=base /app /app
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3001 8080

ENV NODE_ENV=production
ENV PORT=3001

ENTRYPOINT ["/docker-entrypoint.sh"]
