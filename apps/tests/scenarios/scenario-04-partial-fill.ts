import { setup } from "./setup";

// ======================================================
// scenario-04-partial-fill.ts
// ======================================================

{
    const { engine } = setup();

    const response1 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "swati",
        side: "SHORT",
        leverage: 1n,
        qty: 10n,
        price: 100n,
        orderId: "s4-short"
    });

    const response2 = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20n,
        price: 100n,
        orderId: "s4-long"
    });

    console.log(response1,response2);
}


