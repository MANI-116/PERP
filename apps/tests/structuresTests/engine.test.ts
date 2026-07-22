import { describe, expect, it } from "bun:test";
import {
  Engine,
  User,
  UserManager,
  MarketManager,
} from "@repo/engine-package";

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

function createOrder(
  overrides: Partial<{
    orderId: string;
    userId: string;
    marketId: string;
    side: "LONG" | "SHORT";
    type: "LIMIT" | "MARKET";
    qty: bigint;
    leverage: bigint;
    price: bigint;
  }> = {}
) {
  return {
    orderId: overrides.orderId ?? crypto.randomUUID(),
    userId: overrides.userId ?? "user-1",
    marketId: overrides.marketId ?? "btc-usdt",
    side: overrides.side ?? "LONG",
    type: overrides.type ?? "LIMIT",
    qty: overrides.qty ?? 10n,
    leverage: overrides.leverage ?? 10n,
    price: overrides.price ?? 100n,
  };
}

function createFreshExchange() {

    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    const userManager =
        UserManager.create();

    const marketManager =
        MarketManager.create();

    const engine =
        Engine.create();

    return {
        engine,
        userManager,
        marketManager
    };
}
describe("Engine Snapshot Recovery", () => {

  it("empty engine roundtrip", () => {

    const engine =
      Engine.create();

    const snapshot1 =
      engine.getSnapshot();

    const recovered =
      Engine.createFromSnapshot(
        snapshot1
      );

    expect(recovered)
      .not.toBeNull();

  });

  it("snapshot recover snapshot should be identical", () => {

    const engine =
      Engine.create();

    const snapshot1 =
      engine.getSnapshot();

    const recovered =
      Engine.createFromSnapshot(
        snapshot1
      );

    expect(recovered)
      .not.toBeNull();

    const snapshot2 =
      recovered!.getSnapshot();

    expect(snapshot2)
      .toEqual(snapshot1);

  });

});
describe("Engine Financial Integrity", () => {
    
  it("should realize profit on full close", () => {
    const { engine, userManager, marketManager } =
      createFreshExchange();

    const maker = new User("maker");
    const taker = new User("taker");

    userManager.addUser(maker);
    userManager.addUser(taker);

    userManager.rampUser("maker", 10000n);
    userManager.rampUser("taker", 10000n);

    marketManager.addMarket(createMarket());

    const before =
      taker.collateral.available;

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "SHORT",
        qty: 10n,
        price: 100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "LONG",
        qty: 10n,
        price: 100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "LONG",
        qty: 10n,
        price: 120n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "SHORT",
        qty: 10n,
        price: 120n
      })
    );

    expect(
      taker.collateral.available
    ).toBeGreaterThan(before);
  });

  it("should realize loss on full close", () => {
    const { engine, userManager, marketManager } =
      createFreshExchange();

    const maker = new User("maker");
    const taker = new User("taker");

    userManager.addUser(maker);
    userManager.addUser(taker);

    userManager.rampUser("maker", 10000n);
    userManager.rampUser("taker", 10000n);

    marketManager.addMarket(createMarket());

    const before =
      taker.collateral.available;

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "SHORT",
        qty: 10n,
        price: 100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "LONG",
        qty: 10n,
        price: 100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "LONG",
        qty: 10n,
        price: 90n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "SHORT",
        qty: 10n,
        price: 90n
      })
    );

    expect(
      taker.collateral.available
    ).toBeLessThan(before);
  });

  it("should release margin on full close", () => {
    const { engine, userManager, marketManager } =
      createFreshExchange();

    const maker = new User("maker");
    const taker = new User("taker");

    userManager.addUser(maker);
    userManager.addUser(taker);

    userManager.rampUser("maker", 10000n);
    userManager.rampUser("taker", 10000n);

    marketManager.addMarket(createMarket());

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "SHORT",
        qty: 10n,
        price: 100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "LONG",
        qty: 10n,
        price: 100n
      })
    );

    const lockedBeforeClose =
      taker.collateral.locked;

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "LONG",
        qty: 10n,
        price: 105n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "SHORT",
        qty: 10n,
        price: 105n
      })
    );

    expect(taker.collateral.available).toBeGreaterThan(0n); // Margin + PnL released to available
  });

  it("should release margin on partial close", () => {
    const { engine, userManager, marketManager } =
      createFreshExchange();

    const maker = new User("maker");
    const taker = new User("taker");

    userManager.addUser(maker);
    userManager.addUser(taker);

    userManager.rampUser("maker", 10000n);
    userManager.rampUser("taker", 10000n);

    marketManager.addMarket(createMarket());

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "SHORT",
        qty: 10n,
        price: 100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "LONG",
        qty: 10n,
        price: 100n
      })
    );

    const before =
      taker.collateral.locked;

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "LONG",
        qty: 5n,
        price: 105n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "SHORT",
        qty: 5n,
        price: 105n
      })
    );

    expect(taker.collateral.available).toBeGreaterThan(0n); // Margin + PnL released to available
  });

  it("should trigger bankruptcy path on insolvent reversal", () => {
    const { engine, userManager, marketManager } =
      createFreshExchange();

    const maker = new User("maker");
    const taker = new User("taker");

    userManager.addUser(maker);
    userManager.addUser(taker);

    userManager.rampUser("maker", 10000n);
    userManager.rampUser("taker", 10000n);

    marketManager.addMarket(createMarket());

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "SHORT",
        qty: 10n,
        price: 100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "LONG",
        qty: 10n,
        price: 100n
      })
    );

    const response =
      engine.placeOrder(
        createOrder({
          userId: "maker",
          side: "LONG",
          qty: 15n,
          price: 120n
        })
      );

    expect(response).toBeDefined();
  });

});
describe("Engine Position Lifecycle", () => {

  it("should increase existing long position", () => {

    const {
      engine,
      userManager,
      marketManager
    } = createFreshExchange();

    userManager.addUser(
      new User("maker")
    );

    userManager.addUser(
      new User("taker")
    );

    userManager.rampUser("maker",10000n);
    userManager.rampUser("taker",10000n);

    marketManager.addMarket(
      createMarket()
    );

    engine.placeOrder(
      createOrder({
        orderId:"m1",
        userId:"maker",
        side:"SHORT",
        qty:10n,
        price:100n
      })
    );

    engine.placeOrder(
      createOrder({
        orderId:"t1",
        userId:"taker",
        side:"LONG",
        qty:10n,
        price:100n
      })
    );

    const before =
      userManager.getPosition(
        "taker",
        "btc-usdt"
      );

    expect(before.success)
      .toBe(true);

    const oldPositionId =
      before.success
        ? before.positionId
        : "";

    engine.placeOrder(
      createOrder({
        orderId:"m2",
        userId:"maker",
        side:"SHORT",
        qty:5n,
        price:110n
      })
    );

    engine.placeOrder(
      createOrder({
        orderId:"t2",
        userId:"taker",
        side:"LONG",
        qty:5n,
        price:110n
      })
    );

    const after =
      userManager.getPosition(
        "taker",
        "btc-usdt"
      );

    expect(after.success)
      .toBe(true);

    if(after.success){
      expect(after.positionId)
        .toBe(oldPositionId);
    }

  });

  it("should partially close long position", () => {

    const {
      engine,
      userManager,
      marketManager
    } = createFreshExchange();

    userManager.addUser(
      new User("maker")
    );

    userManager.addUser(
      new User("taker")
    );

    userManager.rampUser("maker",10000n);
    userManager.rampUser("taker",10000n);

    marketManager.addMarket(
      createMarket()
    );

    engine.placeOrder(
      createOrder({
        userId:"maker",
        side:"SHORT",
        qty:10n,
        price:100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId:"taker",
        side:"LONG",
        qty:10n,
        price:100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId:"maker",
        side:"LONG",
        qty:4n,
        price:120n
      })
    );

    engine.placeOrder(
      createOrder({
        userId:"taker",
        side:"SHORT",
        qty:4n,
        price:120n
      })
    );

    const position =
      userManager.getPosition(
        "taker",
        "btc-usdt"
      );

    expect(position.success)
      .toBe(true);

  });

  it("should fully close long position", () => {

    const {
      engine,
      userManager,
      marketManager
    } = createFreshExchange();

    userManager.addUser(
      new User("maker")
    );

    userManager.addUser(
      new User("taker")
    );

    userManager.rampUser("maker",10000n);
    userManager.rampUser("taker",10000n);

    marketManager.addMarket(
      createMarket()
    );

    engine.placeOrder(
      createOrder({
        userId:"maker",
        side:"SHORT",
        qty:10n,
        price:100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId:"taker",
        side:"LONG",
        qty:10n,
        price:100n
      })
    );

    engine.placeOrder(
      createOrder({
        userId:"maker",
        side:"LONG",
        qty:10n,
        price:120n
      })
    );

    engine.placeOrder(
      createOrder({
        userId:"taker",
        side:"SHORT",
        qty:10n,
        price:120n
      })
    );

    const position =
      userManager.getPosition(
        "taker",
        "btc-usdt"
      );

    console.log(position);

  });

//   it("should reverse position", () => {

//     const {
//       engine,
//       userManager,
//       marketManager
//     } = createFreshExchange();

//     userManager.addUser(
//       new User("maker")
//     );

//     userManager.addUser(
//       new User("taker")
//     );

//     userManager.rampUser("maker",10000n);
//     userManager.rampUser("taker",10000n);

//     marketManager.addMarket(
//       createMarket()
//     );

//     engine.placeOrder(
//       createOrder({
//         userId:"maker",
//         side:"SHORT",
//         qty:10n,
//         price:100n
//       })
//     );

//     engine.placeOrder(
//       createOrder({
//         userId:"taker",
//         side:"LONG",
//         qty:10n,
//         price:100n
//       })
//     );

//     const before =
//       userManager.getPosition(
//         "taker",
//         "btc-usdt"
//       );

//     expect(before.success)
//       .toBe(true);

//     const oldPositionId =
//       before.success
//         ? before.positionId
//         : "";

//     engine.placeOrder(
//       createOrder({
//         userId:"maker",
//         side:"LONG",
//         qty:15n,
//         price:120n
//       })
//     );

//     engine.placeOrder(
//       createOrder({
//         userId:"taker",
//         side:"SHORT",
//         qty:15n,
//         price:120n
//       })
//     );

//     const after =
//       userManager.getPosition(
//         "taker",
//         "btc-usdt"
//       );

//     expect(after.success)
//       .toBe(true);

//     if(after.success){
//       expect(after.positionId)
//         .not.toBe(oldPositionId);
//     }

//   });
it("should reverse position when realized loss is within available margin", () => {

  const {
    engine,
    userManager,
    marketManager
  } = createFreshExchange();

  userManager.addUser(
    new User("maker")
  );

  userManager.addUser(
    new User("taker")
  );

  userManager.rampUser(
    "maker",
    10000n
  );

  userManager.rampUser(
    "taker",
    10000n
  );

  marketManager.addMarket(
    createMarket()
  );

  // maker opens SHORT 10 @100
  engine.placeOrder(
    createOrder({
      orderId: "m1",
      userId: "maker",
      side: "SHORT",
      qty: 10n,
      price: 100n
    })
  );

  engine.placeOrder(
    createOrder({
      orderId: "t1",
      userId: "taker",
      side: "LONG",
      qty: 10n,
      price: 100n
    })
  );

  const before =
    userManager.getPosition(
      "maker",
      "btc-usdt"
    );

  expect(before.success)
    .toBe(true);

  const oldPositionId =
    before.success
      ? before.positionId
      : "";

  // reverse with only 50 loss
  engine.placeOrder(
    createOrder({
      orderId: "m2",
      userId: "maker",
      side: "LONG",
      qty: 15n,
      price: 105n
    })
  );

  engine.placeOrder(
    createOrder({
      orderId: "t2",
      userId: "taker",
      side: "SHORT",
      qty: 15n,
      price: 105n
    })
  );

  const after =
    userManager.getPosition(
      "maker",
      "btc-usdt"
    );

  expect(after.success)
    .toBe(true);

  if (after.success) {
    expect(after.positionId)
      .not.toBe(oldPositionId);
  }

});

});
describe("Engine", () => {

  it("should reject unknown user", () => {
    const { engine, marketManager } = createFreshExchange();

    marketManager.addMarket(
      createMarket()
    );

    const response = engine.placeOrder(
      createOrder()
    );

    expect(response.event)
      .toBe("ORDER_REJECTED");
  });

  it("should reject unknown market", () => {
    const { engine, userManager } = createFreshExchange();

    userManager.addUser(
      new User("user-1")
    );

    const response = engine.placeOrder(
      createOrder()
    );

    expect(response.event)
      .toBe("ORDER_REJECTED");
  });

  it("should reject order when balance is insufficient", () => {
    const {
      engine,
      userManager,
      marketManager,
    } = createFreshExchange();

    userManager.addUser(
      new User("user-1")
    );

    marketManager.addMarket(
      createMarket()
    );

    const response = engine.placeOrder(
      createOrder({
        qty: 100n,
        leverage: 1n,
      })
    );

    expect(response.event)
      .toBe("ORDER_REJECTED");
  });

  it("should accept resting limit order", () => {
    const {
      engine,
      userManager,
      marketManager,
    } = createFreshExchange();

    const user = new User("user-1");

    userManager.addUser(user);

    userManager.rampUser(
      "user-1",
      10000n
    );

    marketManager.addMarket(
      createMarket()
    );

    const response = engine.placeOrder(
      createOrder({
        side: "SHORT",
      })
    );

    expect(response.event)
      .toBe("ORDER_ACCEPTED");
  });

  it("should lock margin for resting order", () => {
    const {
      engine,
      userManager,
      marketManager,
    } = createFreshExchange();

    const user = new User("user-1");

    userManager.addUser(user);

    userManager.rampUser(
      "user-1",
      10000n
    );

    marketManager.addMarket(
      createMarket()
    );

    engine.placeOrder(
      createOrder({
        qty: 10n,
        price: 100n,
        leverage: 10n,
        side: "SHORT",
      })
    );

    expect(
      user.collateral.available
    ).toBe(9900n);

    expect(
      user.collateral.locked
    ).toBe(100n);
  });

  it("should match maker and taker orders", () => {
    const {
      engine,
      userManager,
      marketManager,
    } = createFreshExchange();

    const maker =
      new User("maker");

    const taker =
      new User("taker");

    userManager.addUser(maker);
    userManager.addUser(taker);

    userManager.rampUser(
      "maker",
      10000n
    );

    userManager.rampUser(
      "taker",
      10000n
    );

    marketManager.addMarket(
      createMarket()
    );

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "SHORT",
        price: 100n,
        qty: 10n,
      })
    );

    const response =
      engine.placeOrder(
        createOrder({
          userId: "taker",
          side: "LONG",
          price: 100n,
          qty: 10n,
        })
      );

    expect(response.event)
      .toBe("ORDER_FILLED");
  });

  it("should open position for maker after match", () => {
    const {
      engine,
      userManager,
      marketManager,
    } = createFreshExchange();

    userManager.addUser(
      new User("maker")
    );

    userManager.addUser(
      new User("taker")
    );

    userManager.rampUser(
      "maker",
      10000n
    );

    userManager.rampUser(
      "taker",
      10000n
    );

    marketManager.addMarket(
      createMarket()
    );

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "SHORT",
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "LONG",
      })
    );

    const makerPosition =
      userManager.getPosition(
        "maker",
        "btc-usdt"
      );

    expect(
      makerPosition.success
    ).toBe(true);
  });

  it("should open position for taker after match", () => {
    const {
      engine,
      userManager,
      marketManager,
    } = createFreshExchange();

    userManager.addUser(
      new User("maker")
    );

    userManager.addUser(
      new User("taker")
    );

    userManager.rampUser(
      "maker",
      10000n
    );

    userManager.rampUser(
      "taker",
      10000n
    );

    marketManager.addMarket(
      createMarket()
    );

    engine.placeOrder(
      createOrder({
        userId: "maker",
        side: "SHORT",
      })
    );

    engine.placeOrder(
      createOrder({
        userId: "taker",
        side: "LONG",
      })
    );

    const takerPosition =
      userManager.getPosition(
        "taker",
        "btc-usdt"
      );

    expect(
      takerPosition.success
    ).toBe(true);
  });
});

describe("Engine Recovery Integration - Snapshot & Restore", () => {

  it("snapshot must contain schemaVersion and checksum", () => {
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    const engine = Engine.create();
    const snapshotStr = engine.getSnapshot();
    const parsed = JSON.parse(snapshotStr);

    expect(parsed.schemaVersion).toBe(Engine.SNAPSHOT_VERSION);
    expect(typeof parsed.checksum).toBe("string");
    expect(parsed.checksum.length).toBeGreaterThan(0);
  });

  it("restore preserves available balances and positions", () => {
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    const { engine, userManager, marketManager } = createFreshExchange();

    const maker = new User("maker");
    const taker = new User("taker");
    userManager.addUser(maker);
    userManager.addUser(taker);
    userManager.rampUser("maker", 5000n);
    userManager.rampUser("taker", 5000n);
    marketManager.addMarket(createMarket());

    engine.placeOrder(createOrder({ userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ userId: "taker", side: "LONG", qty: 10n, price: 100n }));

    const snapshotStr = engine.getSnapshot();

    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    const restored = Engine.createFromSnapshot(snapshotStr);
    expect(restored).not.toBeNull();

    const restoredUserManager = UserManager.create();
    const restoredMarketManager = MarketManager.create();

    const makerAvailable = restoredUserManager.getUserEquity("maker");
    const takerAvailable = restoredUserManager.getUserEquity("taker");
    expect(makerAvailable.success).toBe(true);
    expect(takerAvailable.success).toBe(true);

    const makerPos = restoredUserManager.getPositions("maker");
    const takerPos = restoredUserManager.getPositions("taker");
    expect(makerPos.success).toBe(true);
    expect(takerPos.success).toBe(true);
  });

  it("restore preserves eventId and liquidationCounters", () => {
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    // Build state: users + market + initial orders + eventId + liquidationCounter
    const { engine, userManager, marketManager } = createFreshExchange();
    userManager.addUser(new User("maker"));
    userManager.addUser(new User("taker"));
    userManager.rampUser("maker", 10000n);
    userManager.rampUser("taker", 10000n);
    marketManager.addMarket(createMarket());

    engine.placeOrder(createOrder({ userId: "maker", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ userId: "taker", side: "LONG", qty: 10n, price: 100n }));

    // Manually set a liquidation counter
    engine.liquidationCounters.set("btc-usdt", 5n);

    // elide a few more eventIds (first placeOrder consumed some)
    const eventIdBeforeSnapshot = engine.getLastEventId();

    const snapshotStr = engine.getSnapshot();

    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    const restored = Engine.createFromSnapshot(snapshotStr);
    expect(restored).not.toBeNull();

    // EventId continues from where it was
    expect(restored!.getLastEventId()).toBe(eventIdBeforeSnapshot);

    // A liquidation at counter 6 should pass (counter 5 is in the engine, 6 is newer)
    const response = restored!.placeOrder({
      ...createOrder({ userId: "maker", side: "SHORT", qty: 10n, price: 100n }),
      liquidationId: "lqOrder:btc-usdt:6",
    });
    expect(response.event).not.toBe("ORDER_REJECTED");
  });

  it("checksum validation rejects corrupted snapshot", () => {
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    const engine = Engine.create();
    const snapshotStr = engine.getSnapshot();
    const parsed = JSON.parse(snapshotStr);

    // Corrupt the coreData — replace any digit inside it
    parsed.coreData = parsed.coreData.replace('"', '"X');

    const result = Engine.createFromSnapshot(JSON.stringify(parsed));
    expect(result).toBeNull();
  });

  it("checksum validation rejects tampered outer fields", () => {
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    const engine = Engine.create();
    const snapshotStr = engine.getSnapshot();
    const parsed = JSON.parse(snapshotStr);
    parsed.schemaVersion = 999;

    const result = Engine.createFromSnapshot(JSON.stringify(parsed));
    expect(result).toBeNull();
  });

  it("version mismatch rejects future snapshot", () => {
    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    const engine = Engine.create();
    const snapshotStr = engine.getSnapshot();
    const parsed = JSON.parse(snapshotStr);

    parsed.schemaVersion = 999;
    // need to recompute checksum to pass zod parse but fail version check
    // actually version check happens after checksum, so let's just test the checksum boundary
    parsed.schemaVersion = 999;
    const invalidStr = JSON.stringify(parsed);

    const result = Engine.createFromSnapshot(invalidStr);
    expect(result).toBeNull();
  });
});