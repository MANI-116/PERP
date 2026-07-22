import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Engine } from '../../../packages/engine/structures/engine';
import { User } from '../../../packages/engine/structures/user';

describe('Engine Market Order Margin Bug', () => {
  it('should not crash on market order with multiple levels', () => {
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

    // place asks (maker)
    engine.placeOrder({ type: 'LIMIT', userId: 'u1', marketId: 'BTC_USD', side: 'SHORT', price: 33n, qty: 1n, leverage: 1n, orderId: 'o1' });
    engine.placeOrder({ type: 'LIMIT', userId: 'u1', marketId: 'BTC_USD', side: 'SHORT', price: 34n, qty: 2n, leverage: 1n, orderId: 'o2' });

    // place market order (taker)
    try {
      const res = engine.placeOrder({ type: 'MARKET', userId: 'u2', marketId: 'BTC_USD', side: 'LONG', price: 0n, qty: 3n, leverage: 1n, orderId: 'o3' });
      console.log(res);
      expect(res.event).not.toBe('ORDER_REJECTED');
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
});
