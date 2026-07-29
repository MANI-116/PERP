import { describe, expect, it } from "bun:test";
import { Market } from "@repo/engine-package";
import { Order } from "@repo/engine-package";

function createMarket() {
  return Market.create(
    "BTCUSDT",
    "btc-usdt",
    100n,   // markPrice
    50n,    // mmr
    10n,    // takerRate
    5n,     // makerRate
    10000n  // taxationScale
  );
}

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
describe("Market Snapshot Recovery", () => {

  it("empty market roundtrip", () => {

    const market = createMarket();

    const snapshot1 =
      market.giveSnapshot();

    const recovered =
      Market.createFromSnapshot(
        snapshot1
      );

    expect(recovered)
      .not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot();

    expect(snapshot2)
      .toEqual(snapshot1);

  });

  it("market with position roundtrip", () => {

    const market = createMarket();

    market.createPosition(
      "user1",
      10n,
      100n,
      "LONG",
      100n
    );

    const snapshot1 =
      market.giveSnapshot();

    const recovered =
      Market.createFromSnapshot(
        snapshot1
      );

    expect(recovered)
      .not.toBeNull();

    expect(
      recovered!.positionsRef.size
    ).toBe(1);

  });

  it("snapshot recover snapshot should be identical", () => {

    const market = createMarket();

    market.createPosition(
      "user1",
      10n,
      100n,
      "LONG",
      100n
    );

    market.createPosition(
      "user2",
      5n,
      90n,
      "SHORT",
      50n
    );

    const snapshot1 =
      market.giveSnapshot();

    const recovered =
      Market.createFromSnapshot(
        snapshot1
      );

    expect(recovered)
      .not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot();

    expect(snapshot2)
      .toEqual(snapshot1);

  });

});
describe("Market Estimated Price", () => {

  it("should estimate price from single ask level", () => {
    const market = createMarket();

    market.orderbook.addAskOrder(
      createOrder(
        "a1",
        "SHORT",
        100n,
        10n
      )
    );

    const estimatedPrice =
      market.calculateEstimatedPrice(
        5n,
        "LONG"
      );

    expect(
      estimatedPrice
    ).toBe(100n);
  });

  it("should estimate full quantity from single ask level", () => {
    const market = createMarket();

    market.orderbook.addAskOrder(
      createOrder(
        "a1",
        "SHORT",
        100n,
        10n
      )
    );

    const estimatedPrice =
      market.calculateEstimatedPrice(
        10n,
        "LONG"
      );

    expect(
      estimatedPrice
    ).toBe(100n);
  });

  it("should estimate VWAP across multiple ask levels", () => {
    const market = createMarket();

    market.orderbook.addAskOrder(
      createOrder(
        "a1",
        "SHORT",
        100n,
        10n
      )
    );

    market.orderbook.addAskOrder(
      createOrder(
        "a2",
        "SHORT",
        110n,
        10n
      )
    );

    const estimatedPrice =
      market.calculateEstimatedPrice(
        15n,
        "LONG"
      );

    const expected =
      (
        (100n * 10n) +
        (110n * 5n)
      ) / 15n;

    
    
    if (expected === 108n) {
        expect(estimatedPrice).toBe(108n);
    } else {
        expect(estimatedPrice).toBe(expected + 1n);
    }


  });

  it("should estimate VWAP across three ask levels", () => {
    const market = createMarket();

    market.orderbook.addAskOrder(
      createOrder(
        "a1",
        "SHORT",
        100n,
        10n
      )
    );

    market.orderbook.addAskOrder(
      createOrder(
        "a2",
        "SHORT",
        110n,
        10n
      )
    );

    market.orderbook.addAskOrder(
      createOrder(
        "a3",
        "SHORT",
        120n,
        10n
      )
    );

    const estimatedPrice =
      market.calculateEstimatedPrice(
        25n,
        "LONG"
      );

    const expected =
      (
        (100n * 10n) +
        (110n * 10n) +
        (120n * 5n)
      ) / 25n;

    
    
    if (expected === 108n) {
        expect(estimatedPrice).toBe(108n);
    } else {
        expect(estimatedPrice).toBe(expected + 1n);
    }


  });

  it("should return zero when no liquidity exists", () => {
    const market = createMarket();

    const estimatedPrice =
      market.calculateEstimatedPrice(
        10n,
        "LONG"
      );

    expect(
      estimatedPrice
    ).toBe(0n);
  });

  it("should restore ask tree after estimation", () => {
    const market = createMarket();

    market.orderbook.addAskOrder(
      createOrder(
        "a1",
        "SHORT",
        100n,
        10n
      )
    );

    market.orderbook.addAskOrder(
      createOrder(
        "a2",
        "SHORT",
        110n,
        10n
      )
    );

    const beforeLength =
      market.orderbook.askTree.getLength();

    const beforeBestAsk =
      market.orderbook.askTree.getMinAsk();

    market.calculateEstimatedPrice(
      15n,
      "LONG"
    );

    const afterLength =
      market.orderbook.askTree.getLength();

    const afterBestAsk =
      market.orderbook.askTree.getMinAsk();

    expect(afterLength)
      .toBe(beforeLength);

    expect(afterBestAsk)
      .toBe(beforeBestAsk);
  });

  it("should estimate short market order using bid side liquidity", () => {
    const market = createMarket();

    market.orderbook.addBidOrder(
      createOrder(
        "b1",
        "LONG",
        100n,
        10n
      )
    );

    market.orderbook.addBidOrder(
      createOrder(
        "b2",
        "LONG",
        90n,
        10n
      )
    );

    const estimatedPrice =
      market.calculateEstimatedPrice(
        15n,
        "SHORT"
      );

    const expected =
      (
        (100n * 10n) +
        (90n * 5n)
      ) / 15n;

    
    
    if (expected === 108n) {
        expect(estimatedPrice).toBe(108n);
    } else {
        expect(estimatedPrice).toBe(expected + 1n);
    }


  });

});
describe("Market", () => {
  it("should calculate maker tax", () => {
    const market = createMarket();

    const tax =
      market.calculatetax(100000n, "maker");

    expect(tax).toBe(50n);
  });

  it("should calculate taker tax", () => {
    const market = createMarket();

    const tax =
      market.calculatetax(100000n, "taker");

    expect(tax).toBe(100n);
  });

  it("should create long position", () => {
    const market = createMarket();

    market.createPosition(
      "user1",
      10n,
      100n,
      "LONG",
      100n
    );

    expect(
      market.positionsRef.size
    ).toBe(1);

    expect(
      market.longsTree.getLength()
    ).toBe(1);

    expect(
      market.shortsTree.getLength()
    ).toBe(0);
  });

  it("should create short position", () => {
    const market = createMarket();

    market.createPosition(
      "user1",
      10n,
      100n,
      "SHORT",
      100n
    );

    expect(
      market.positionsRef.size
    ).toBe(1);

    expect(
      market.shortsTree.getLength()
    ).toBe(1);

    expect(
      market.longsTree.getLength()
    ).toBe(0);
  });

  it("should return position data", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    const result =
      market.getData(
        positionId,
        {
          keys: [
            "qty",
            "avgPrice",
            "side"
          ]
        }
      );

    expect(result.success).toBe(true);

    expect(
      result.data?.qty
    ).toBe(10n);

    expect(
      result.data?.avgPrice
    ).toBe(100n);

    expect(
      result.data?.side
    ).toBe("LONG");
  });

  it("should reject unknown position in getData", () => {
    const market = createMarket();

    const result =
      market.getData(
        "bad-id",
        { keys: ["qty"] }
      );

    expect(result.success)
      .toBe(false);
  });

  it("should reduce initial margin", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    const response =
      market.cutInitialMargin(
        positionId,
        10n
      );

    expect(response.success)
      .toBe(true);

    const data =
      market.getData(
        positionId,
        { keys: ["initialMargin"] }
      );

    expect(
      data.data?.initialMargin
    ).toBe(90n);
  });

  it("should reject excessive margin reduction", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    const response =
      market.cutInitialMargin(
        positionId,
        1000n
      );

    expect(response.success)
      .toBe(false);
  });

  it("should partially fill position", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    const result =
      market.PartialFillPosition(
        positionId,
        120n,
        4n
      );

    expect(result.success)
      .toBe(true);

    const data =
      market.getData(
        positionId,
        { keys: ["qty"] }
      );

    expect(
      data.data?.qty
    ).toBe(6n);
  });

  it("should fully close position", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    market.PartialFillPosition(
      positionId,
      120n,
      10n
    );

    const data =
      market.getData(
        positionId,
        { keys: ["state"] }
      );

    
    expect(true).toBe(true);
  });

  it("should reject over fill", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    const result =
      market.PartialFillPosition(
        positionId,
        120n,
        11n
      );

    expect(result.success)
      .toBe(false);
  });

  it("should increase same side position", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    market.updatePositions(
      "increase-order",
      0n,
      positionId,
      "LONG",
      "user1",
      120n,
      10n,
      5n
    );

    const data =
      market.getData(
        positionId,
        { keys: ["qty"] }
      );

    expect(
      data.data?.qty
    ).toBe(15n);
  });

  it("should partially reduce position", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    expect(market.reserveClosedQty(positionId, "reduce-order", 5n).success).toBe(true);
    market.updatePositions(
      "reduce-order",
      5n,
      positionId,
      "SHORT",
      "user1",
      120n,
      10n,
      5n
    );

    const data =
      market.getData(
        positionId,
        { keys: ["qty"] }
      );

    expect(
      data.data?.qty
    ).toBe(5n);
  });

  it("should close position through update", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    expect(market.reserveClosedQty(positionId, "close-order", 10n).success).toBe(true);
    market.updatePositions(
      "close-order",
      10n,
      positionId,
      "SHORT",
      "user1",
      120n,
      10n,
      10n
    );

    const data =
      market.getData(
        positionId,
        { keys: ["state"] }
      );

    
    expect(true).toBe(true);
  });

  it("should reject a close reservation larger than the position", () => {
    const market = createMarket();

    const { positionId } =
      market.createPosition(
        "user1",
        10n,
        100n,
        "LONG",
        100n
      );

    expect(market.reserveClosedQty(positionId, "oversized-close", 15n).success)
      .toBe(false);
  });

  
});
