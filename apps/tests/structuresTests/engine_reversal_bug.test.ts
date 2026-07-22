import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Engine } from '../../../packages/engine/structures/engine';
import { User } from '../../../packages/engine/structures/user';

describe('Engine Reversal Bug', () => {
  it('should not duplicate position on reversal', () => {
    const engine = new Engine();
    
    // setup users
    engine.userManager.addUser(new User('u1'));
    engine.userManager.addUser(new User('u2'));
    
    // add funds
    engine.userManager.rampUser('u1', 100000n);
    engine.userManager.rampUser('u2', 100000n);

    // create market
    engine.marketManager.addMarket({
      symbol: "BTCUSDT",
      marketId: "BTC_USD",
      markPrice: 100n,
      mmr: 50n,
      takerRate: 10n,
      makerRate: 5n,
      taxationScale: 10000n,
    });

    engine.placeOrder({ type: 'LIMIT', userId: 'u1', marketId: 'BTC_USD', side: 'SHORT', price: 100n, qty: 10n, leverage: 1n, orderId: 'o1' });
    engine.placeOrder({ type: 'LIMIT', userId: 'u2', marketId: 'BTC_USD', side: 'LONG', price: 100n, qty: 10n, leverage: 1n, orderId: 'o2' });

    const market = engine.marketManager.getMarket('BTC_USD')!;
    
    console.log("Before o4, longs keys:", Array.from(market.longs.keys()));
    let u2Pos: any;
    market.positionsRef.forEach((pos) => { if (pos.value.userId === 'u2') u2Pos = pos.value; });
    console.log("U2 Pos LP:", u2Pos?.liquidationPrice);

    engine.placeOrder({ type: 'LIMIT', userId: 'u2', marketId: 'BTC_USD', side: 'SHORT', price: 100n, qty: 15n, leverage: 1n, orderId: 'o3' });
    engine.placeOrder({ type: 'LIMIT', userId: 'u1', marketId: 'BTC_USD', side: 'LONG', price: 100n, qty: 15n, leverage: 1n, orderId: 'o4' });

  });
});
