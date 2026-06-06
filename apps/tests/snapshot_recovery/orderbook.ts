import { describe, expect, it } from "bun:test";

import { Order,OrderBook } from "@repo/engine-package";

function createOrder(
  id: string,
  side: "LONG" | "SHORT",
  price: bigint,
  qty: bigint = 10n
) {
  return new Order(
    id,
    "user-1",
    "btc-usdt",
    qty,
    side,
    price,
    10n,
    "LIMIT"
  );
}

describe("OrderBook Snapshot Recovery", () => {

  it("should recover empty orderbook", () => {
    const book = new OrderBook();

    const snapshot =
      book.giveSnapshot().orderSnapshotString;

    const recovered =
      OrderBook.createFromSnapshot(snapshot);

    expect(recovered).not.toBeNull();
    expect(recovered!.asks.size).toBe(0);
    expect(recovered!.bids.size).toBe(0);
  });

  it("should recover ask levels", () => {
    const book = new OrderBook();

    book.addAskOrder(
      createOrder("1", "SHORT", 100n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();
    expect(recovered!.asks.has(100n)).toBe(true);
    expect(recovered!.asks.size).toBe(1);
  });

  it("should recover bid levels", () => {
    const book = new OrderBook();

    book.addBidOrder(
      createOrder("1", "LONG", 100n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();
    expect(recovered!.bids.has(100n)).toBe(true);
    expect(recovered!.bids.size).toBe(1);
  });

  it("should recover multiple ask price levels", () => {
    const book = new OrderBook();

    book.addAskOrder(
      createOrder("1", "SHORT", 100n)
    );

    book.addAskOrder(
      createOrder("2", "SHORT", 110n)
    );

    book.addAskOrder(
      createOrder("3", "SHORT", 120n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();

    expect(recovered!.asks.size).toBe(3);
    expect(recovered!.asks.has(100n)).toBe(true);
    expect(recovered!.asks.has(110n)).toBe(true);
    expect(recovered!.asks.has(120n)).toBe(true);
  });

  it("should recover multiple bid price levels", () => {
    const book = new OrderBook();

    book.addBidOrder(
      createOrder("1", "LONG", 100n)
    );

    book.addBidOrder(
      createOrder("2", "LONG", 90n)
    );

    book.addBidOrder(
      createOrder("3", "LONG", 80n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();

    expect(recovered!.bids.size).toBe(3);
    expect(recovered!.bids.has(100n)).toBe(true);
    expect(recovered!.bids.has(90n)).toBe(true);
    expect(recovered!.bids.has(80n)).toBe(true);
  });

  it("should recover multiple orders at same ask level", () => {
    const book = new OrderBook();

    book.addAskOrder(
      createOrder("1", "SHORT", 100n)
    );

    book.addAskOrder(
      createOrder("2", "SHORT", 100n)
    );

    book.addAskOrder(
      createOrder("3", "SHORT", 100n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();

    const level =
      recovered!.asks.get(100n);

    expect(level).toBeDefined();
    expect(level!.length).toBe(3);
  });

  it("should recover multiple orders at same bid level", () => {
    const book = new OrderBook();

    book.addBidOrder(
      createOrder("1", "LONG", 100n)
    );

    book.addBidOrder(
      createOrder("2", "LONG", 100n)
    );

    book.addBidOrder(
      createOrder("3", "LONG", 100n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();

    const level =
      recovered!.bids.get(100n);

    expect(level).toBeDefined();
    expect(level!.length).toBe(3);
  });

  it("should rebuild order references", () => {
    const book = new OrderBook();

    const order =
      createOrder("order-1", "SHORT", 100n);

    book.addAskOrder(order);

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();

    const response =
      recovered!.deleteOrder("order-1");

    expect(response.success).toBe(true);
  });

  it("should recover ask tree", () => {
    const book = new OrderBook();

    book.addAskOrder(
      createOrder("1", "SHORT", 100n)
    );

    book.addAskOrder(
      createOrder("2", "SHORT", 120n)
    );

    book.addAskOrder(
      createOrder("3", "SHORT", 140n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.askTree.getLength()
    ).toBe(3);
  });

  it("should recover bid tree", () => {
    const book = new OrderBook();

    book.addBidOrder(
      createOrder("1", "LONG", 100n)
    );

    book.addBidOrder(
      createOrder("2", "LONG", 90n)
    );

    book.addBidOrder(
      createOrder("3", "LONG", 80n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.bidTree.getLength()
    ).toBe(3);
  });

  it("snapshot -> recover -> snapshot should be identical", () => {
    const book = new OrderBook();

    book.addAskOrder(
      createOrder("1", "SHORT", 100n)
    );

    book.addAskOrder(
      createOrder("2", "SHORT", 100n)
    );

    book.addAskOrder(
      createOrder("3", "SHORT", 120n)
    );

    book.addBidOrder(
      createOrder("4", "LONG", 90n)
    );

    book.addBidOrder(
      createOrder("5", "LONG", 80n)
    );

    const snapshot1 =
      book.giveSnapshot().orderSnapshotString;

    const recovered =
      OrderBook.createFromSnapshot(snapshot1);

    expect(recovered).not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot().orderSnapshotString;

    expect(snapshot2).toEqual(snapshot1);
  });

  it("should reject corrupted snapshot", () => {
    const recovered =
      OrderBook.createFromSnapshot(
        '{"bad":"data"}'
      );

    expect(recovered).toBeNull();
  });

});