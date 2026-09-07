FROM oven/bun:1.3.14

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/perps"

RUN bun --cwd packages/db prisma generate \
    --schema=prisma/schema.prisma

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor \
    && rm -rf /var/lib/apt/lists/*

COPY fly/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY fly/nginx.conf /etc/nginx/nginx.conf
COPY fly/start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]