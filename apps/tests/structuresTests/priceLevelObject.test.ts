import { describe, expect, it } from "bun:test";
(BigInt.prototype as any).toJSON = function() { return this.toString(); };

import { Order, PriceLevelObject } from "@repo/engine-package";

function createOrder(id: string, qty: bigint = 10n, price: bigint = 100n) {
  return new Order(id, "user-1", "btc-usdt", qty, "LONG", price, 10n, "LIMIT", qty);
}

describe("PriceLevel Snapshot Recovery", () => {
  it("should recover a single order price level", () => {
    const order = createOrder("1", 10n);
    const level = PriceLevelObject.createFromOrder(order);
    const snapshot = level.giveSnapshot();
    const recovered = PriceLevelObject.createFromSnapShort(snapshot, Order.createFromSnapshot);
    expect(recovered).not.toBeNull();
    expect(recovered!.length).toBe(level.length);
    expect(recovered!.totalQty).toBe(level.totalQty);
  });

  it("should preserve total quantity", () => {
    const order = createOrder("1", 25n);
    const level = PriceLevelObject.createFromOrder(order);
    const recovered = PriceLevelObject.createFromSnapShort(level.giveSnapshot(), Order.createFromSnapshot);
    expect(recovered).not.toBeNull();
    expect(recovered!.totalQty).toBe(25n);
  });

  it("should preserve length", () => {
    const order = createOrder("1", 10n);
    const level = PriceLevelObject.createFromOrder(order);
    const recovered = PriceLevelObject.createFromSnapShort(level.giveSnapshot(), Order.createFromSnapshot);
    expect(recovered).not.toBeNull();
    expect(recovered!.length).toBe(1);
  });

  it("should recover underlying DLL", () => {
    const order = createOrder("1");
    const level = PriceLevelObject.createFromOrder(order);
    const recovered = PriceLevelObject.createFromSnapShort(level.giveSnapshot(), Order.createFromSnapshot);
    expect(recovered).not.toBeNull();
    const first = recovered!.list.getFirstOrder();
    expect(first.value.orderId).toBe(order.orderId);
  });

  it("snapshot -> recover -> snapshot should be identical", () => {
    const order = createOrder("1", 10n);
    const level = PriceLevelObject.createFromOrder(order);
    const snapshot1 = level.giveSnapshot();
    const recovered = PriceLevelObject.createFromSnapShort(snapshot1, Order.createFromSnapshot);
    expect(recovered).not.toBeNull();
    const snapshot2 = recovered!.giveSnapshot();
    expect(snapshot2).toEqual(snapshot1);
  });

  it("should reject corrupted snapshot", () => {
    const recovered = PriceLevelObject.createFromSnapShort('{"bad":"data"}', Order.createFromSnapshot);
    expect(recovered).toBeNull();
  });
});
