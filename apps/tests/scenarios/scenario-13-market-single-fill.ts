import { setup } from "./setup";

// ======================================================
// scenario-13-market-single-fill.ts
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
        orderId: "s13-short"
    });

    const res2 = engine.placeOrder({
        type: "MARKET",
        marketId: "sol",
        userId: "ravi",
        side: "LONG",
        leverage: 1n,
        qty: 20n,
        price: 0n,
        orderId: "s13-market"
    });

    console.log(res1,res2);
}


