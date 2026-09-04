FROM oven/bun:1.3.14

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

# Prisma client generation only needs the variable to exist
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/perps"

RUN bun --cwd packages/db prisma generate \
    --schema=prisma/schema.prisma

ENV NODE_ENV=production

WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["bun", "index.ts"]