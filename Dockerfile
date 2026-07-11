FROM oven/bun:1.3 AS base
WORKDIR /app

# Install deps (cached layer)
COPY package.json bun.lock ./
COPY packages/ packages/
COPY apps/ apps/

RUN bun install

# Generate Prisma client
WORKDIR /app/packages/db
RUN bunx prisma generate
WORKDIR /app

# ── Runtime ─────────────────────────────────────────────
FROM oven/bun:1.3 AS runtime
WORKDIR /app

COPY --from=base /app /app
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /app/packages/db/generated && chmod -R 755 /app/packages/db/generated

EXPOSE 3001 8080

ENV NODE_ENV=production
ENV PORT=3001

ENTRYPOINT ["/docker-entrypoint.sh"]
