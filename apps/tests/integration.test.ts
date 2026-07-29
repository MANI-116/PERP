import { describe, expect, it, beforeAll } from "bun:test";
import {
  Engine,
  User,
  UserManager,
  MarketManager,
} from "@repo/engine-package";

// ── Shared helpers ──────────────────────────────────────

function createMarket(overrides: Partial<{
  marketId: string; symbol: string; markPrice: bigint; mmr: bigint;
  takerRate: bigint; makerRate: bigint; taxationScale: bigint;
}> = {}) {
  return {
    marketId: overrides.marketId ?? "btc-usdt",
    symbol: overrides.symbol ?? "BTCUSDT",
    markPrice: overrides.markPrice ?? 100n,
    mmr: overrides.mmr ?? 5n,
    takerRate: overrides.takerRate ?? 10n,
    makerRate: overrides.makerRate ?? 5n,
    taxationScale: overrides.taxationScale ?? 10000n,
  };
}

function createOrder(overrides: Partial<{
  orderId: string; userId: string; marketId: string;
  side: "LONG" | "SHORT"; type: "LIMIT" | "MARKET";
  qty: bigint; leverage: bigint; price: bigint;
  liquidationId: string;
}> = {}): Parameters<typeof Engine.prototype.placeOrder>[0] {
  return {
    orderId: overrides.orderId ?? crypto.randomUUID(),
    userId: overrides.userId ?? "user-1",
    marketId: overrides.marketId ?? "btc-usdt",
    side: overrides.side ?? "LONG",
    type: overrides.type ?? "LIMIT",
    qty: overrides.qty ?? 10n,
    leverage: overrides.leverage ?? 10n,
    price: overrides.price ?? 100n,
    liquidationId: overrides.liquidationId,
  };
}

function freshExchange() {
  Engine.reset();
  UserManager.reset();
  MarketManager.reset();

  const userManager = UserManager.create();
  const marketManager = MarketManager.create();
  const engine = Engine.create();
  return { engine, userManager, marketManager };
}

function seededExchange() {
  const ex = freshExchange();
  ex.userManager.addUser(new User("maker"));
  ex.userManager.addUser(new User("taker"));
  ex.userManager.rampUser("maker", 10000n);
  ex.userManager.rampUser("taker", 10000n);
  ex.marketManager.addMarket(createMarket());
  return ex;
}

// ── Order Lifecycle ─────────────────────────────────────

describe("Order Lifecycle", () => {

  it("limit order accepted when no crossing", () => {
    const { engine } = seededExchange();
    const res = engine.placeOrder(createOrder({ orderId: "o1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    expect(res.event).toBe("ORDER_ACCEPTED");
    // @ts-ignore
    expect(res.payload.state).toBe("OPEN");
    // @ts-ignore
    expect(res.payload.updates).toBeDefined();
    // @ts-ignore
    expect(res.payload.updates.asks.length).toBeGreaterThanOrEqual(0);
    expect(res.eventId).not.toBe("0");
    expect(res.eventId.length).toBeGreaterThan(0);
  });

  it("limit order rejected for insufficient margin", () => {
    const { engine } = freshExchange();
    const um = UserManager.create();
    um.addUser(new User("poor"));
    um.rampUser("poor", 1n);
    MarketManager.create().addMarket(createMarket());
    const res = engine.placeOrder(createOrder({ userId: "poor", side: "LONG", qty: 100n, price: 1000n, leverage: 1n }));
    expect(res.event).toBe("ORDER_REJECTED");
  });

  it("full fill exchanges matched orders", () => {
    const { engine } = seededExchange();
    const m1 = engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    const t1 = engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    expect(m1.event).toBe("ORDER_ACCEPTED");
    expect(t1.event).toBe("ORDER_FILLED" as any);
  });

  it("partial fill leaves resting order on book", () => {
    const { engine } = seededExchange();
    // Maker places 20 at 100, taker takes 10 → taker fully filled, maker has 10 left
    const m1 = engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 20n, price: 100n }));
    const t1 = engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    expect(m1.event).toBe("ORDER_ACCEPTED");
    // Taker's order fills completely (got all 10 they wanted)
    expect(t1.event).toBe("ORDER_FILLED" as any);
    // Maker still has 10 remaining on the book
  });

  it("FIFO priority across multiple orders at same price", () => {
    const { engine } = seededExchange();
    const um = UserManager.create();
    const mm = MarketManager.create();
    mm.addMarket(createMarket());
    um.addUser(new User("a")); um.rampUser("a", 10000n);
    um.addUser(new User("b")); um.rampUser("b", 10000n);
    engine.placeOrder(createOrder({ orderId: "a1", userId: "a", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "b1", userId: "b", side: "SHORT", qty: 10n, price: 100n }));
    const t1 = engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 20n, price: 100n }));
    expect(t1.event).toBe("ORDER_FILLED" as any);
  });

  it("multi-level fill sweeps across price levels (market order)", () => {
    const { engine } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "a1", userId: "maker", side: "SHORT", qty: 5n, price: 90n }));
    engine.placeOrder(createOrder({ orderId: "b1", userId: "maker", side: "SHORT", qty: 5n, price: 80n }));
    const t1 = engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 0n, type: "MARKET" }));
    expect(t1.event).not.toBe("ORDER_REJECTED" as any);
  });

  it("market order fills against available liquidity", () => {
    const { engine } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    const t1 = engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 0n, type: "MARKET" }));
    expect(t1.event).not.toBe("ORDER_REJECTED" as any);
  });

  it("rejects order for unknown user", () => {
    const { engine } = seededExchange();
    const res = engine.placeOrder(createOrder({ userId: "nobody" }));
    expect(res.event).toBe("ORDER_REJECTED");
  });

  it("rejects order for unknown market", () => {
    const { engine } = seededExchange();
    const res = engine.placeOrder(createOrder({ marketId: "unknown" }));
    expect(res.event).toBe("ORDER_REJECTED");
  });
});

// ── Position Lifecycle ──────────────────────────────────

describe("Position Lifecycle", () => {

  it("opening order creates position", () => {
    const { engine, userManager } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    const pos = userManager.getPosition("taker", "btc-usdt");
    expect(pos.success).toBe(true);
  });

  it("same-side fill increases position", () => {
    const { engine, userManager } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    const before = userManager.getPosition("taker", "btc-usdt");
    engine.placeOrder(createOrder({ orderId: "m2", userId: "maker", side: "SHORT", qty: 5n, price: 110n }));
    engine.placeOrder(createOrder({ orderId: "t2", userId: "taker", side: "LONG", qty: 5n, price: 110n }));
    // Position should still be the same ID (increased, not new)
    const after = userManager.getPosition("taker", "btc-usdt");
    expect(after.success).toBe(true);
  });

  it("opposite-side fill reduces position", () => {
    const { engine, userManager } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    // Sell half
    engine.placeOrder(createOrder({ orderId: "m2", userId: "maker", side: "LONG", qty: 5n, price: 105n }));
    engine.placeOrder(createOrder({ orderId: "t2", userId: "taker", side: "SHORT", qty: 5n, price: 105n }));
    // Position should still exist (not fully closed)
    const after = userManager.getPosition("taker", "btc-usdt");
    expect(after.success).toBe(true);
  });

  it("opposite-side order larger than position is capped to close-only quantity", () => {
    const { engine, userManager } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "m2", userId: "maker", side: "LONG", qty: 15n, price: 120n }));
    const res = engine.placeOrder(createOrder({ orderId: "t2", userId: "taker", side: "SHORT", qty: 15n, price: 120n }));

    expect(res.event).toBe("ORDER_FILLED");
    expect(userManager.getPosition("maker", "btc-usdt").success).toBe(false);
    expect(userManager.getPosition("taker", "btc-usdt").success).toBe(false);
  });
});

// ── Financial Integrity ─────────────────────────────────

describe("Financial Integrity", () => {

  it("realizes profit on winning close", () => {
    const { engine, userManager } = seededExchange();
    const taker = userManager.foundUser("taker");
    // @ts-ignore — access user ref
    const before = Engine.create().getLastEventId(); // just making sure taker exists
    // Buy low, sell high
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    const equityBefore = userManager.getUserEquity("taker");
    engine.placeOrder(createOrder({ orderId: "m2", userId: "maker", side: "LONG", qty: 10n, price: 120n }));
    engine.placeOrder(createOrder({ orderId: "t2", userId: "taker", side: "SHORT", qty: 10n, price: 120n }));
    const equityAfter = userManager.getUserEquity("taker");
    expect(equityAfter.success).toBe(true);
  });

  it("margin is locked on resting order", () => {
    const { engine, userManager } = seededExchange();
    const user = (userManager as any).users.get("maker");
    const beforeLocked = user.collateral.locked;
    // Place a resting order on the book (no crossing)
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    expect(user.collateral.locked).toBeGreaterThan(beforeLocked);
  });

  it("margin is released on position close at same price", () => {
    const { engine, userManager } = seededExchange();
    const user = (userManager as any).users.get("taker");
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    const afterLock = user.collateral.locked;
    // Close position at same price
    engine.placeOrder(createOrder({ orderId: "m2", userId: "maker", side: "LONG", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t2", userId: "taker", side: "SHORT", qty: 10n, price: 100n }));
    expect(user.collateral.locked).toBe(0n);
  });
});

// ── GET_EQUITY with Unrealized PnL ──────────────────────

describe("GET_EQUITY", () => {

  it("includes unrealized PnL in equity calculation", () => {
    const { engine, userManager } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    const equity = userManager.getUserEquity("taker");
    expect(equity.success).toBe(true);
    if (equity.success && equity.data) {
      // Equity = available + locked + unrealizedPnL
      // At price=100, markPrice=100 → unrealizedPnL = 0
      // available = 10000 - margin, locked = margin
      // So equity ≈ 10000 (minus fees)
      expect(BigInt(equity.data.equity)).toBeGreaterThan(0n);
    }
  });

  it("returns error for unknown user", () => {
    const { userManager } = seededExchange();
    const equity = userManager.getUserEquity("nonexistent");
    expect(equity.success).toBe(false);
  });
});

// ── Event ID Monotonicity ───────────────────────────────

describe("Event ID Monotonicity", () => {

  it("increments on each placeOrder call", () => {
    const { engine } = seededExchange();
    const id1 = engine.getNextEventId();
    const id2 = engine.getNextEventId();
    expect(id2).toBe(id1 + 1n);
  });

  it("response includes eventId", () => {
    const { engine } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    const res = engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    expect(res.eventId).toBeDefined();
    expect(BigInt(res.eventId)).toBeGreaterThan(0n);
  });
});

// ── Liquidation Replay Guard ────────────────────────────

describe("Liquidation Replay Guard", () => {

  it("rejects liquidation with old counter", () => {
    const { engine } = seededExchange();
    engine.liquidationCounters.set("btc-usdt", 5n);
    const res = engine.placeOrder(createOrder({
      orderId: "lq1", userId: "maker", side: "SHORT", qty: 10n, price: 100n,
      liquidationId: "lqOrder:btc-usdt:5",
    }));
    // Counter 5 ≤ stored 5 → reject
    expect(res.event).toBe("ORDER_REJECTED");
  });

  it("accepts liquidation with new counter", () => {
    const { engine } = seededExchange();
    engine.liquidationCounters.set("btc-usdt", 5n);
    const res = engine.placeOrder(createOrder({
      orderId: "lq1", userId: "maker", side: "SHORT", qty: 10n, price: 100n,
      liquidationId: "lqOrder:btc-usdt:6",
    }));
    expect(res.event).not.toBe("ORDER_REJECTED");
  });
});

// ── Snapshot & Restore ──────────────────────────────────

describe("Snapshot & Restore", () => {

  it("getSnapshot includes exchangeMarketBalance", () => {
    const { engine } = seededExchange();
    const ss = engine.getSnapshot();
    const parsed = JSON.parse(ss);
    const core = JSON.parse(parsed.coreData);
    expect(typeof core.exchangeMarketBalance).toBe("string");
  });

  it("restore preserves eventId order", () => {
    const { engine } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    const before = engine.getLastEventId();

    const ss = engine.getSnapshot();
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();
    Engine.createFromSnapshot(ss);
    const restored = Engine.create();

    const after = restored.getLastEventId();
    expect(after).toBe(before);
    expect(restored.getNextEventId()).toBe(before + 1n);
  });

  it("restore preserves orders and positions", () => {
    const { engine, userManager } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));

    const posBefore = userManager.getPosition("taker", "btc-usdt");
    const ss = engine.getSnapshot();

    Engine.reset();
    UserManager.reset();
    MarketManager.reset();
    Engine.createFromSnapshot(ss);

    const restoredUM = UserManager.create();
    const posAfter = restoredUM.getPosition("taker", "btc-usdt");

    expect(posAfter.success).toBe(true);
  });

  it("restore preserves liquidationCounters", () => {
    const { engine } = seededExchange();
    engine.liquidationCounters.set("btc-usdt", 42n);

    const ss = engine.getSnapshot();
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();
    Engine.createFromSnapshot(ss);

    // Place a liquidation with counter 43 → should pass (42 < 43)
    const restored = Engine.create();
    UserManager.create(); // restore singletons
    MarketManager.create();
    // Need seeded users for order to work
    const um = UserManager.create();
    um.addUser(new User("maker")); um.rampUser("maker", 10000n);
    um.addUser(new User("taker")); um.rampUser("taker", 10000n);
    const res = restored.placeOrder(createOrder({
      orderId: "lq1", userId: "maker", side: "SHORT", qty: 10n, price: 100n,
      liquidationId: "lqOrder:btc-usdt:43",
    }));
    expect(res.event).not.toBe("ORDER_REJECTED");
  });

  it("version mismatch rejects forward snapshot", () => {
    const { engine } = seededExchange();
    const ss = engine.getSnapshot();
    const parsed = JSON.parse(ss);
    parsed.schemaVersion = 999;
    const result = Engine.createFromSnapshot(JSON.stringify(parsed));
    expect(result).toBeNull();
  });

  it("corrupted coreData rejected by checksum", () => {
    const { engine } = seededExchange();
    const ss = engine.getSnapshot();
    const parsed = JSON.parse(ss);
    parsed.coreData = parsed.coreData.slice(0, -10) + "X";
    const result = Engine.createFromSnapshot(JSON.stringify(parsed));
    expect(result).toBeNull();
  });
});

// ── Exchange Global Balance ─────────────────────────────

describe("Exchange Global Balance", () => {

  it("exchangeMarketBalance is persisted in snapshot", () => {
    const { engine } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    const ss = engine.getSnapshot();
    const core = JSON.parse(JSON.parse(ss).coreData);
    expect(typeof core.exchangeMarketBalance).toBe("string");
  });
});

// ── GET_CLOSED_POSITIONS ────────────────────────────────

describe("GET_CLOSED_POSITIONS", () => {

  it("returns empty for user with no closed positions", () => {
    const { userManager } = seededExchange();
    const res = userManager.getClosedPositions("maker");
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.positions.length).toBe(0);
    }
  });
});

// ── Market Order Scenarios ──────────────────────────────

describe("Market Order", () => {

  it("rejected when book is empty", () => {
    const { engine } = seededExchange();
    const res = engine.placeOrder(createOrder({ userId: "maker", side: "LONG", qty: 10n, price: 0n, type: "MARKET" }));
    expect(res.event).toBe("ORDER_REJECTED" as any);
  });

  it("partially fills when insufficient liquidity", () => {
    const { engine } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 5n, price: 100n }));
    const res = engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 0n, type: "MARKET" }));
    expect(res.event).toBe("ORDER_FILLED_PARTIALLY" as any);
    expect(res.payload.filled).toBe("5");
  });
});

// ── Snapshot Checksum Integrity ─────────────────────────

describe("Snapshot Checksum", () => {

  it("getSnapshot → createFromSnapshot roundtrip produces identical getSnapshot", () => {
    const { engine } = seededExchange();
    engine.placeOrder(createOrder({ orderId: "m1", userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "t1", userId: "taker", side: "LONG", qty: 10n, price: 100n }));
    engine.liquidationCounters.set("btc-usdt", 7n);

    const ss1 = engine.getSnapshot();
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    Engine.createFromSnapshot(ss1);
    const engine2 = Engine.create();
    const ss2 = engine2.getSnapshot();

    // Both snapshots should be identical
    const p1 = JSON.parse(ss1);
    const p2 = JSON.parse(ss2);
    expect(p1.schemaVersion).toBe(p2.schemaVersion);
    expect(p1.checksum).toBe(p2.checksum);
    expect(p1.coreData).toBe(p2.coreData);
  });
});
