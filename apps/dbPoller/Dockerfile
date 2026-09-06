FROM oven/bun:1.3.14
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

# Prisma config requires DATABASE_URL during build
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/perps"

RUN bun --cwd packages/db prisma generate --schema=prisma/schema.prisma

ENV NODE_ENV=production

WORKDIR /app/apps/dbPoller

CMD ["bun", "index.ts"]