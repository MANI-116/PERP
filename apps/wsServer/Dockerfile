FROM oven/bun:1.3.14

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

# Prisma config requires DATABASE_URL during build
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/perps"

RUN bun --cwd packages/db prisma generate --schema=prisma/schema.prisma

ENV NODE_ENV=development

WORKDIR /app/apps/wsServer

EXPOSE 3002

CMD ["bun", "index.ts"]