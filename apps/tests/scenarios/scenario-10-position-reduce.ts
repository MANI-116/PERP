import { setup } from "./setup";

// ======================================================
// scenario-10-position-reduce.ts
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
        orderId: "s10-open-short"
    });

    const res2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20n,
        price: 100n,
        orderId: "s10-open-long"
    });

    const res3 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "LONG",
        leverage: 1n,
        qty: 5n,
        price: 100n,
        orderId: "s10-close-long"
    });

    const res4 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "SHORT",
        leverage: 1n,
        qty: 5n,
        price: 100n,
        orderId: "s10-close-short"
    });

    console.log(res1,res2,res3,res4);
}

