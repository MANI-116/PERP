import { setup } from "./setup";

// ======================================================
// scenario-08-no-crossing.ts
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
        price: 105n,
        orderId: "s8-short"
    });

    const res2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 5n,
        price: 100n,
        orderId: "s8-long"
    });

    console.log(res1,res2);
}


