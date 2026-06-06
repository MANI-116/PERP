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

describe("OrderBook", () => {

  it("should create empty orderbook", () => {
    const book = new OrderBook();

    expect(book.asks.size).toBe(0);
    expect(book.bids.size).toBe(0);

    expect(book.askTree.getLength()).toBe(0);
    expect(book.bidTree.getLength()).toBe(0);
  });

  it("should add first ask order", () => {
    const book = new OrderBook();

    book.addAskOrder(
      createOrder("1", "SHORT", 100n)
    );

    expect(book.asks.size).toBe(1);

    const level =
      book.asks.get(100n);

    expect(level).toBeDefined();
    expect(level!.length).toBe(1);

    expect(book.askTree.getLength())
      .toBe(1);

    expect(book.askTree.getMinAsk())
      .toBe(100n);
  });

  it("should add first bid order", () => {
    const book = new OrderBook();

    book.addBidOrder(
      createOrder("1", "LONG", 100n)
    );

    expect(book.bids.size).toBe(1);

    const level =
      book.bids.get(100n);

    expect(level).toBeDefined();
    expect(level!.length).toBe(1);

    expect(book.bidTree.getLength())
      .toBe(1);

    expect(book.bidTree.getTop())
      .toBe(100n);
  });

  it("should add multiple ask price levels", () => {
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

    expect(book.asks.size).toBe(3);

    expect(book.askTree.getLength())
      .toBe(3);

    expect(book.askTree.getMinAsk())
      .toBe(100n);
  });

  it("should add multiple bid price levels", () => {
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

    expect(book.bids.size).toBe(3);

    expect(book.bidTree.getLength())
      .toBe(3);

    expect(book.bidTree.getTop())
      .toBe(100n);
  });

  it("should add multiple orders to same ask level", () => {
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

    const level =
      book.asks.get(100n);

    expect(level).toBeDefined();

    expect(level!.length).toBe(3);
  });

  it("should add multiple orders to same bid level", () => {
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

    const level =
      book.bids.get(100n);

    expect(level).toBeDefined();

    expect(level!.length).toBe(3);
  });

  it("should remove ask order", () => {
    const book = new OrderBook();

    const order =
      createOrder("1", "SHORT", 100n);

    book.addAskOrder(order);

    book.removeAskOrder(order);

    expect(
      book.asks.get(100n)
    ).toBeUndefined();
  });

  it("should remove bid order", () => {
    const book = new OrderBook();

    const order =
      createOrder("1", "LONG", 100n);

    book.addBidOrder(order);

    book.removeBuyOrder(order);

    expect(
      book.bids.get(100n)
    ).toBeUndefined();
  });

  it("should remove one order from multi order ask level", () => {
    const book = new OrderBook();

    const o1 =
      createOrder("1", "SHORT", 100n);

    const o2 =
      createOrder("2", "SHORT", 100n);

    book.addAskOrder(o1);
    book.addAskOrder(o2);

    book.removeAskOrder(o1);

    const level =
      book.asks.get(100n);

    expect(level).toBeDefined();
    expect(level!.length).toBe(1);
  });

  it("should remove one order from multi order bid level", () => {
    const book = new OrderBook();

    const o1 =
      createOrder("1", "LONG", 100n);

    const o2 =
      createOrder("2", "LONG", 100n);

    book.addBidOrder(o1);
    book.addBidOrder(o2);

    book.removeBuyOrder(o1);

    const level =
      book.bids.get(100n);

    expect(level).toBeDefined();
    expect(level!.length).toBe(1);
  });

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

    expect(
      recovered!.asks.has(100n)
    ).toBe(true);
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

    expect(
      recovered!.bids.has(100n)
    ).toBe(true);
  });

  it("should recover multiple levels", () => {
    const book = new OrderBook();

    book.addAskOrder(
      createOrder("1", "SHORT", 100n)
    );

    book.addAskOrder(
      createOrder("2", "SHORT", 120n)
    );

    book.addBidOrder(
      createOrder("3", "LONG", 90n)
    );

    book.addBidOrder(
      createOrder("4", "LONG", 80n)
    );

    const recovered =
      OrderBook.createFromSnapshot(
        book.giveSnapshot().orderSnapshotString
      );

    expect(recovered).not.toBeNull();

    expect(recovered!.asks.size)
      .toBe(2);

    expect(recovered!.bids.size)
      .toBe(2);
  });

  it("snapshot -> recover -> snapshot should be identical", () => {
    const book = new OrderBook();

    book.addAskOrder(
      createOrder("1", "SHORT", 100n)
    );

    book.addAskOrder(
      createOrder("2", "SHORT", 100n)
    );

    book.addBidOrder(
      createOrder("3", "LONG", 90n)
    );

    book.addBidOrder(
      createOrder("4", "LONG", 80n)
    );

    const snapshot1 =
      book.giveSnapshot().orderSnapshotString;

    const recovered =
      OrderBook.createFromSnapshot(
        snapshot1
      );

    expect(recovered).not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot().orderSnapshotString;

    expect(snapshot2)
      .toEqual(snapshot1);
  });

  it("should reject corrupted snapshot", () => {
    const recovered =
      OrderBook.createFromSnapshot(
        '{"bad":"data"}'
      );

    expect(recovered).toBeNull();
  });

});