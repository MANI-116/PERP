# WebSocket market-data server

The WebSocket server fans out incremental orderbook updates from `response-stream` to clients subscribed per market.

## Run

```bash
REDIS_URL=redis://localhost:6379 DATABASE_URL=postgresql://... bun run apps/wsServer/index.ts
```

It listens on port `8080`.

## Protocol

Subscribe:

```json
{ "type": "subscribe", "marketId": "<market-id>" }
```

Unsubscribe:

```json
{ "type": "unsubscribe", "marketId": "<market-id>" }
```

Update:

```json
{ "type": "update", "data": { "uid": 42, "bids": [], "asks": [["price", "qty"]] } }
```

`uid` is the orderbook update sequence. Clients must fetch a REST depth snapshot before/after subscribing, apply only contiguous deltas, and refetch whenever they detect a gap. A `qty` of `"0"` removes the level.

## Delivery semantics

This server is a real-time convenience stream, not a durable client ledger. Clients can disconnect, miss updates, or reconnect to another process; snapshot-plus-sequence reconciliation is mandatory. The server filters engine response events to orderbook-affecting events and uses event IDs to ignore duplicates.
