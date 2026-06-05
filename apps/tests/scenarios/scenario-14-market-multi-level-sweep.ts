import { setup } from "./setup";

// ======================================================
// scenario-14-market-multi-level-sweep.ts
// ======================================================

{
    const { engine } = setup();

    const res1 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "SHORT",
        leverage: 1n,
        qty: 5n,
        price: 100n,
        orderId: "s14-short-100"
    });

    const res2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "kavi",
        side: "SHORT",
        leverage: 1n,
        qty: 5n,
        price: 101n,
        orderId: "s14-short-101"
    });

    const res3 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "SHORT",
        leverage: 1n,
        qty: 5n,
        price: 102n,
        orderId: "s14-short-102"
    });

    const res4 = engine.placeOrder({
        type: "MARKET",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 12n,
        price: 0n,
        orderId: "s14-market"
    });

    console.log(res1,res2,res3,res4);
}