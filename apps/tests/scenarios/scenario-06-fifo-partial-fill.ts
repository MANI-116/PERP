import { setup } from "./setup";

// ======================================================
// scenario-06-fifo-partial-fill.ts
// ======================================================

{
    const { engine } = setup();

    const res1= engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "SHORT",
        leverage: 1n,
        qty: 5n,
        price: 100n,
        orderId: "s6-short-1"
    });

    const res2= engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "kavi",
        side: "SHORT",
        leverage: 1n,
        qty: 7n,
        price: 100n,
        orderId: "s6-short-2"
    });

    const res3 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 8n,
        price: 100n,
        orderId: "s6-long"
    });

    console.log(res1,res2,res3);
}


