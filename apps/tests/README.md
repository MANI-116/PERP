# Test suite

Tests are organized around core structures, matching scenarios, and integration behavior.

```bash
# Entire suite
bun test apps/tests/

# Engine-focused unit tests
bun test apps/tests/structuresTests/engine.test.ts

# End-to-end/integration coverage
bun test apps/tests/integration.test.ts
```

## Coverage expectations

When altering matching or accounting code, add or update tests for the exact invariant affected:

- price-time priority and self-match behavior;
- `totalQty` equals the sum of unfilled resting quantities at every price level;
- full/partial fills and multi-level market sweeps;
- cancellation and reserved-margin release;
- same-side increase, reduction, close, flip, fee, and PnL calculations;
- snapshot restore and replay behavior.

Use integer `bigint` values in engine tests. Do not hide an accounting regression by asserting only outbound WebSocket data—assert the underlying orderbook state too.
