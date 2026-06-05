import { setup } from "./setup";

// ======================================================
// scenario-09-position-increase.ts
// ======================================================

{
    const { engine } = setup();

    const res1 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "SHORT",
        leverage: 1n,
        qty: 20n,
        price: 100n,
        orderId: "s9-short-1"
    });

    const res2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20n,
        price: 100n,
        orderId: "s9-long-1"
    });

    const res3 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "SHORT",
        leverage: 1n,
        qty: 10n,
        price: 100n,
        orderId: "s9-short-2"
    });

    const res4 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 10n,
        price: 100n,
        orderId: "s9-long-2"
    });

    console.log(res1,res2,res3,res4);
}


