# `@repo/types`

Shared TypeScript contracts for PerpX commands, events, and domain values.

## Contract boundary

`src/engine/request.ts` defines commands accepted by the engine worker. `src/engine/response.ts` defines results emitted on `response-stream`. `src/domain` holds reusable order, transaction, and market shapes.

Redis messages serialize all `bigint` values as decimal strings. The engine adapter parses them before invoking the domain core; consumers must not use floating-point parsing for financial fields.

## Adding an engine command

1. Add the request type and payload to `EngineRequestMap`.
2. Add the response payload to `EventResponseMap`.
3. Implement dispatch in `apps/engine/engineManager.ts`.
4. Update every affected consumer: backend resolver, database projector, WebSocket fan-out, and tests.

Treat event names and payload fields as versioned public contracts. Prefer additive changes and make consumers tolerant of unknown fields.
