import { describe, expect, it } from "bun:test";
(BigInt.prototype as any).toJSON = function() { return this.toString(); };

import { Order, OrderBook } from "@repo/engine-package";

function createOrder(id: string, side: any, price: bigint, type: any = "LIMIT", qty: bigint = 10n) {
  return new Order(id, "user-" + id, "btc-usdt", qty, side, price, 10n, type, qty);
}

describe("OrderBook Market Orders", () => {

  it("should match market order against multiple price levels", () => {
    const book = new OrderBook();
    book.addAskOrder(createOrder("1", "SHORT", 100n, "LIMIT", 10n));
    book.addAskOrder(createOrder("2", "SHORT", 101n, "LIMIT", 10n));
    
    // Taker buys 15
    const mo = createOrder("3", "LONG", 0n, "MARKET", 15n);
    const res = book.matchMarketOrder(mo) as any;
    
    expect(res.event).toBe("ORDER_FILLED");
    expect(res.payload.filled).toBe(15n);
    expect(res.payload.matchedOrders.length).toBe(2);
    expect(res.payload.matchedOrders[0].qtyTransfered).toBe(10n);
    expect(res.payload.matchedOrders[1].qtyTransfered).toBe(5n);

    // Updates should contain both depleted 100n and partial 101n
    const updates = res.payload.updates;
    expect(updates.asks.length).toBe(2);
    expect(updates.asks[0]).toEqual(["100", "0"]); // 100 is fully depleted
    expect(updates.asks[1]).toEqual(["101", "5"]); // 101 has 5 left
  });

  it("should completely fill market order", () => {
    const book = new OrderBook();
    book.addBidOrder(createOrder("1", "LONG", 100n, "LIMIT", 10n));
    book.addBidOrder(createOrder("2", "LONG", 99n, "LIMIT", 10n));
    
    // Taker sells 20
    const mo = createOrder("3", "SHORT", 0n, "MARKET", 20n);
    const res = book.matchMarketOrder(mo) as any;
    
    expect(res.event).toBe("ORDER_FILLED");
    expect(res.payload.filled).toBe(20n);
    
    // Updates should have 100 and 99 depleted
    const updates = res.payload.updates;
    expect(updates.bids.length).toBe(2);
    expect(updates.bids[0]).toEqual(["100", "0"]); 
    expect(updates.bids[1]).toEqual(["99", "0"]); 
  });
});
