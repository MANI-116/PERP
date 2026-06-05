import { setup } from "./setup";

// ======================================================
// scenario-03-full-fill.ts
// ======================================================

{
    const { engine } = setup();

    const response1 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "SHORT",
        leverage: 1n,
        qty: 20n,
        price: 100n,
        orderId: "s3-short"
    });

    const response2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20n,
        price: 100n,
        orderId: "s3-long"
    });

    console.log(response1,response2);
}
