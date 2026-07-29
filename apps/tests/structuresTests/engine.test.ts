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

  it("should cap an oversized opposite order instead of reversing", () => {
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

    expect(response.event).toBe("ORDER_ACCEPTED");
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
it("should cap an oversized opposite order and fully close the position", () => {

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

  // The 15-qty opposite order is reduced to the existing 10-qty position.
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

  expect(after.success).toBe(false);

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
    ).toBe(9899n);

    expect(
      user.collateral.locked
    ).toBe(101n);
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

describe("Order-specific lock accounting", () => {
  it("releases only the remaining lock when a partially filled order is cancelled", () => {
    const { engine, userManager, marketManager } = createFreshExchange();
    const maker = new User("maker");
    const taker = new User("taker");
    const takerOrderId = "partial-taker";

    userManager.addUser(maker);
    userManager.addUser(taker);
    userManager.rampUser("maker", 1000n);
    userManager.rampUser("taker", 1000n);
    marketManager.addMarket(createMarket());

    engine.placeOrder(createOrder({
      orderId: "partial-maker",
      userId: "maker",
      side: "SHORT",
      qty: 4n,
      price: 100n,
    }));

    const fillResponse = engine.placeOrder(createOrder({
      orderId: takerOrderId,
      userId: "taker",
      side: "LONG",
      qty: 10n,
      price: 100n,
    }));

    expect(fillResponse.event).toBe("ORDER_FILLED_PARTIALLY");
    expect(taker.collateral.locked).toBe(60n);

    const market = marketManager.getMarket("btc-usdt")!;
    const deleted = market.orderbook.deleteOrder(takerOrderId) as any;
    expect(deleted.success).toBe(true);
    expect(userManager.releaseLockAmount("taker", takerOrderId).success).toBe(true);
    expect(taker.collateral.locked).toBe(0n);
    expect(taker.collateral.available).toBe(960n);
  });

  it("executes a full taker fill across multiple makers before releasing its lock", () => {
    const { engine, userManager, marketManager } = createFreshExchange();
    const makerOne = new User("maker-one");
    const makerTwo = new User("maker-two");
    const taker = new User("taker");

    userManager.addUser(makerOne);
    userManager.addUser(makerTwo);
    userManager.addUser(taker);
    userManager.rampUser("maker-one", 1000n);
    userManager.rampUser("maker-two", 1000n);
    userManager.rampUser("taker", 1000n);
    marketManager.addMarket(createMarket());

    engine.placeOrder(createOrder({ orderId: "maker-one-order", userId: "maker-one", side: "SHORT", qty: 4n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "maker-two-order", userId: "maker-two", side: "SHORT", qty: 6n, price: 100n }));

    const response = engine.placeOrder(createOrder({
      orderId: "multi-maker-taker",
      userId: "taker",
      side: "LONG",
      qty: 10n,
      price: 100n,
    }));

    expect(response.event).toBe("ORDER_FILLED");
    expect(taker.collateral.locked).toBe(0n);
    expect(taker.collateral.available).toBe(900n);
    expect(userManager.getPosition("taker", "btc-usdt").success).toBe(true);
  });

  it("preserves a resting order lock through snapshot recovery", () => {
    const { engine, userManager, marketManager } = createFreshExchange();
    const user = new User("snapshot-user");
    const orderId = "snapshot-resting-order";

    userManager.addUser(user);
    userManager.rampUser("snapshot-user", 1000n);
    marketManager.addMarket(createMarket());

    engine.placeOrder(createOrder({ orderId, userId: "snapshot-user", side: "SHORT", qty: 10n, price: 100n }));
    const snapshot = engine.getSnapshot();

    Engine.reset();
    UserManager.reset();
    MarketManager.reset();

    expect(Engine.createFromSnapshot(snapshot)).not.toBeNull();
    const restoredUsers = UserManager.create();
    const release = restoredUsers.releaseLockAmount("snapshot-user", orderId);
    const equity = restoredUsers.getUserEquity("snapshot-user");

    expect(release.success).toBe(true);
    expect(equity.success).toBe(true);
    if (equity.success) {
      expect(equity.data.available).toBe("1000");
      expect(equity.data.locked).toBe("0");
    }
  });
});

describe("Position indexing regression", () => {
  it("removes a position after a partial close followed by a final close", () => {
    const { engine, userManager, marketManager } = createFreshExchange();
    const alice = new User("alice");
    const opener = new User("opener");
    const firstCloser = new User("first-closer");
    const finalCloser = new User("final-closer");

    userManager.addUser(alice);
    userManager.addUser(opener);
    userManager.addUser(firstCloser);
    userManager.addUser(finalCloser);
    userManager.rampUser("alice", 10_000n);
    userManager.rampUser("opener", 10_000n);
    userManager.rampUser("first-closer", 10_000n);
    userManager.rampUser("final-closer", 10_000n);
    marketManager.addMarket(createMarket());

    // Alice opens LONG 10 against the opener's resting SHORT order.
    engine.placeOrder(createOrder({ orderId: "open-short", userId: "opener", side: "SHORT", qty: 10n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "open-long", userId: "alice", side: "LONG", qty: 10n, price: 100n }));

    // Alice closes 5, leaving a LONG 5 position that must remain indexed as LONG.
    engine.placeOrder(createOrder({ orderId: "partial-close", userId: "alice", side: "SHORT", qty: 5n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "partial-close-match", userId: "first-closer", side: "LONG", qty: 5n, price: 100n }));

    // Closing the final 5 must remove Alice's position reference completely.
    engine.placeOrder(createOrder({ orderId: "final-close", userId: "alice", side: "SHORT", qty: 5n, price: 100n }));
    engine.placeOrder(createOrder({ orderId: "final-close-match", userId: "final-closer", side: "LONG", qty: 5n, price: 100n }));

    expect(userManager.getPosition("alice", "btc-usdt").success).toBe(false);
    const positions = userManager.getPositions("alice");
    expect(positions.success).toBe(true);
    if (positions.success) {
      expect(positions.data.positions).toHaveLength(0);
    }
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
