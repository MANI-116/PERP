import { setup } from "./setup";

// ======================================================
// scenario-05-fifo-full-fill.ts
// ======================================================

{
    const { engine } = setup();

    const response1 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "SHORT",
        leverage: 1n,
        qty: 5n,
        price: 100n,
        orderId: "s5-short-1"
    });

    const response2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "kavi",
        side: "SHORT",
        leverage: 1n,
        qty: 7n,
        price: 100n,
        orderId: "s5-short-2"
    });

    const res3 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 12n,
        price: 100n,
        orderId: "s5-long"
    });
    console.log(response1,response2,res3);
}
