import { describe, expect, it } from "bun:test";
import { MarketManager } from "@repo/engine-package";

function createMarket() {
  return {
    symbol: "BTCUSDT",
    marketId: "btc-usdt",
    markPrice: 100n,
    mmr: 50n,
    takerRate: 10n,
    makerRate: 5n,
    taxationScale: 10000n,
  };
}

function newMarketManager(){
    MarketManager.reset();
    return MarketManager.create();
}

describe("MarketManager Snapshot Recovery", () => {

  it("empty manager roundtrip", () => {

    const manager =
      newMarketManager()

    const snapshot1 =
      manager.giveSnapshot();

    const recovered =
      MarketManager.createFromSnapshot(
        snapshot1
      );

    expect(recovered)
      .not.toBeNull();

  });

  it("single market roundtrip", () => {

    const manager =
      newMarketManager()

    manager.addMarket(
      createMarket()
    );

    const snapshot1 =
      manager.giveSnapshot();

    const recovered =
      MarketManager.createFromSnapshot(
        snapshot1
      );

    expect(recovered)
      .not.toBeNull();

    expect(
      recovered!.getMarket(
        "btc-usdt"
      )
    ).toBeDefined();

  });

  it("snapshot recover snapshot should be identical", () => {

    const manager =
      newMarketManager()

    manager.addMarket(
      createMarket()
    );

    const snapshot1 =
      manager.giveSnapshot();

    const recovered =
      MarketManager.createFromSnapshot(
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

describe("MarketManager", () => {

  it("should add market", () => {
    const manager = newMarketManager()

    const response =
      manager.addMarket(
        createMarket()
      );

    expect(
      response.success
    ).toBe(true);

    expect(
      manager.getMarket(
        "btc-usdt"
      )
    ).toBeDefined();
  });

  it("should reject duplicate market", () => {
    const manager = newMarketManager()

    manager.addMarket(
      createMarket()
    );

    const response =
      manager.addMarket(
        createMarket()
      );

    expect(
      response.success
    ).toBe(false);
  });

  it("should return market by id", () => {
    const manager = newMarketManager()

    manager.addMarket(
      createMarket()
    );

    const market =
      manager.getMarket(
        "btc-usdt"
      );

    expect(
      market?.marketId
    ).toBe("btc-usdt");
  });

  it("should return undefined for unknown market", () => {
    const manager = newMarketManager()

    const market =
      manager.getMarket(
        "unknown"
      );

    expect(
      market
    ).toBeUndefined();
  });

  it("should preserve market configuration", () => {
    const manager = newMarketManager()

    manager.addMarket(
      createMarket()
    );

    const market =
      manager.getMarket(
        "btc-usdt"
      );

    expect(
      market?.symbol
    ).toBe("BTCUSDT");

    expect(
      market?.markPrice
    ).toBe(100n);

    expect(
      market?.mmr
    ).toBe(50n);
  });

});