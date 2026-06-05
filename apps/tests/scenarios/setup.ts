// ======================================================
// setup.ts
// ======================================================

import {
    UserManager,
    MarketManager,
    Engine,
    User
} from "../../../packages/engine";

import {
    type IMarket
} from "../../../packages/types/src/domain";

import {
    type CreateOrderRequest
} from "../../../packages/types/src/engine";

export function setup() {
    const userManager = UserManager.create();
    const marketManager = MarketManager.create();
    const engine = Engine.create();

    const sol: IMarket = {
        symbol: "sol",
        marketId: "sol",
        markPrice: 98n,
        mmr: 5n,
        takerRate: 2n,
        makerRate: 1n,
        taxationScale: 3n
    };

    marketManager.addMarket(sol);

    const ravi = new User("ravi");
    const kavi = new User("kavi");
    const swati = new User("swati");

    userManager.addUser(ravi);
    userManager.addUser(kavi);
    userManager.addUser(swati);

    userManager.rampUser("ravi", 50000n);
    userManager.rampUser("kavi", 5000000n);
    userManager.rampUser("swati", 500000n);

    return {
        engine,
        userManager,
        marketManager
    };
}
