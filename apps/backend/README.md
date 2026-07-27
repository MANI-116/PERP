# Backend API

The backend is the HTTP boundary for account, trading, and query operations. It validates requests with Zod, authenticates JWT cookies, writes engine commands to Redis, and resolves each request when the correlated engine response arrives.

## Run

```bash
PORT=3001 REDIS_URL=redis://localhost:6379 DATABASE_URL=postgresql://... JWT_PASS=... \
  bun run apps/backend/index.ts
```

Required variables: `REDIS_URL`, `DATABASE_URL`, `JWT_PASS`. `PORT` defaults to `3000`; deployments commonly set it to `3001`.

## Request/response correlation

`util.ts` assigns a correlation ID, stores a resolver, appends the command to `engine-stream`, and waits up to ten seconds for a `response-stream` message bearing the same ID. This makes engine commands synchronous from an HTTP client's perspective while keeping matching outside the API process.

Timeouts mean the caller did not receive an answer; they do **not** prove the engine did not process the command. Clients placing orders should supply or retain an idempotency strategy at the application boundary before retries are introduced.

## Authentication

`POST /signin` returns a JWT and sets an `Authorization` cookie. `AuthMiddleWare` verifies that cookie and places the token's user ID in `req.body.userId`; trading handlers should use that value rather than trust a body value.

Set CORS origins explicitly in a deployment environment. Use HTTPS, secure/HTTP-only cookie settings, rate limits, and privileged-route authorization before exposing this API publicly.

## API contracts

See the root README for endpoint inventory and example order payloads. Query endpoints read either live engine state (equity, positions, depth) or PostgreSQL projections (orders, fills, markets); these views can be temporarily asynchronous relative to one another.
