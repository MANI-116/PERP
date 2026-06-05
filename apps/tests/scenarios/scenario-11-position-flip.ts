import { setup } from "./setup";

// ======================================================
// scenario-11-position-flip.ts
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
        orderId: "s11-short-open"
    });

    const res2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20n,
        price: 100n,
        orderId: "s11-long-open"
    });

    const res3 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "LONG",
        leverage: 1n,
        qty: 30n,
        price: 100n,
        orderId: "s11-long-flip"
    });

    const res4 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "SHORT",
        leverage: 1n,
        qty: 30n,
        price: 100n,
        orderId: "s11-short-flip"
    });

    console.log(res1,res2,res3,res4);
}

