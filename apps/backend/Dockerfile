FROM oven/bun
WORKDIR /app
COPY package.json .
COPY bun.lock .
COPY tsconfig.json .

RUN bun install

COPY . .

CMD ["bun", "run", "start"]