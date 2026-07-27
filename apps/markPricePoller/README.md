# Mark-price poller

The poller adapts an external WebSocket mark-price feed into `UPDATE_MARKPRICE` commands on `engine-stream`. The engine uses those commands to evaluate liquidation-price buckets and enqueue liquidation orders.

## Run

```bash
REDIS_URL=redis://localhost:6379 BINANCE_URL=wss://<provider-stream> \
  bun run apps/markPricePoller/index.ts
```

The feed payload is expected to expose `p` as price and `s` as symbol. Configure market identity mapping deliberately: the symbol emitted by the provider must resolve to the engine market expected by the command adapter.

## Operations and safety

- Treat the feed as untrusted external input: validate freshness, sequence, symbol mapping, and numeric scale before production use.
- Alert on feed disconnects, stale prices, and command-publication failures.
- The current reconnect strategy exits after a short delay so a supervisor can restart it; run it under a process manager.
- Do not use a public third-party price stream as the sole liquidation oracle in a real-money deployment.
