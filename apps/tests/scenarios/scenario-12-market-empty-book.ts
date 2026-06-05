import { setup } from "./setup";

// ======================================================
// scenario-12-market-empty-book.ts
// ======================================================

{
    const { engine } = setup();

    const res1 = engine.placeOrder({
        type: "MARKET",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20n,
        price: 0n,
        orderId: "s12-market"
    });
console.log(res1);
}


