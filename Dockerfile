FROM oven/bun:1.3 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/ packages/
COPY apps/ apps/

RUN bun install

FROM oven/bun:1.3 AS runtime
WORKDIR /app

COPY --from=base /app /app
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3001 8080
ENV NODE_ENV=production PORT=3001

ENTRYPOINT ["/docker-entrypoint.sh"]
