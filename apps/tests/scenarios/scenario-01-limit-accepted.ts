// ======================================================
// scenario-01-limit-accepted.ts
// ======================================================

import { setup } from "./setup";

{
    const { engine } = setup();

    const response = engine.placeOrder({
        type: "LIMIT",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20n,
        price: 100n,
        orderId: "s1-long"
    });
    console.log(response);
}

