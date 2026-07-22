import { describe, it, expect } from 'bun:test';
import { Engine } from '../../../packages/engine/structures/engine';
import { User } from '../../../packages/engine/structures/user';

describe('Engine Multiple Fill Reversal Bug', () => {
  it('should not crash when taker reverses position across multiple fills', () => {
    const engine = new Engine();
    
    // setup users
    engine.userManager.addUser(new User('taker'));
    engine.userManager.addUser(new User('maker1'));
    engine.userManager.addUser(new User('maker2'));
    
    engine.userManager.rampUser('taker', 100000n);
    engine.userManager.rampUser('maker1', 100000n);
    engine.userManager.rampUser('maker2', 100000n);

    engine.marketManager.addMarket({
      symbol: "BTCUSDT",
      marketId: "BTC_USD",
      markPrice: 100n,
      mmr: 50n,
      takerRate: 10n,
      makerRate: 5n,
      taxationScale: 10000n,
    });

    // Taker opens LONG 10
    engine.placeOrder({ type: 'LIMIT', userId: 'taker', marketId: 'BTC_USD', side: 'LONG', price: 100n, qty: 10n, leverage: 1n, orderId: 't1' });
    // Maker1 provides the SHORT liquidity
    engine.placeOrder({ type: 'LIMIT', userId: 'maker1', marketId: 'BTC_USD', side: 'SHORT', price: 100n, qty: 10n, leverage: 1n, orderId: 'm1' });
    
    // Taker is now LONG 10.
    
    // Now Makers place LONG liquidity
    engine.placeOrder({ type: 'LIMIT', userId: 'maker1', marketId: 'BTC_USD', side: 'LONG', price: 100n, qty: 10n, leverage: 1n, orderId: 'm2' });
    engine.placeOrder({ type: 'LIMIT', userId: 'maker2', marketId: 'BTC_USD', side: 'LONG', price: 99n, qty: 10n, leverage: 1n, orderId: 'm3' });

    // Taker places SHORT 20 as a LIMIT order!
    // Fill 1: 10 lots against m2 (Taker reverses 10, closing position).
    // Fill 2: 10 lots against m3 (Taker opens new SHORT 10).
    try {
      engine.placeOrder({ type: 'LIMIT', userId: 'taker', marketId: 'BTC_USD', side: 'SHORT', price: 99n, qty: 20n, leverage: 1n, orderId: 't2' });
      console.log("Success!");
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
});
