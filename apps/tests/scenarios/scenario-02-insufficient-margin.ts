import { setup } from "./setup";

// ======================================================
// scenario-02-insufficient-margin.ts
// ======================================================

{
    const { engine } = setup();

    const response = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20000n,
        price: 101n,
        orderId: "s2-long"
    });
    console.log(response);
}

