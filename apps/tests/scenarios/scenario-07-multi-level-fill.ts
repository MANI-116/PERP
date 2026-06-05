import { setup } from "./setup";

// ======================================================
// scenario-07-multi-level-fill.ts
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
        orderId: "s7-short-100"
    });

    const res2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "kavi",
        side: "SHORT",
        leverage: 1n,
        qty: 5n,
        price: 101n,
        orderId: "s7-short-101"
    });

    const res3 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 8n,
        price: 101n,
        orderId: "s7-long"
    });

    console.log(res1,res2,res3);
}

