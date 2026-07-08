import { MarketManager, Node, Position } from '@repo/engine-package';
import { sender } from '.';

function generateId() {
  return `${'lqOrder' + Date.now() + Math.floor(Math.random() * 1e6)}`;
}

class LiquidationEngine {
  private static liquidationEngine: LiquidationEngine | null = null;
  private liquidationCounter = new Map<string, bigint>();

  static reset() {
    LiquidationEngine.liquidationEngine = null;
  }

  private constructor() {}

  static create() {
    if (LiquidationEngine.liquidationEngine) {
      return LiquidationEngine.liquidationEngine;
    }
    LiquidationEngine.liquidationEngine = new LiquidationEngine();
    return LiquidationEngine.liquidationEngine;
  }

  private getMarketManager(): MarketManager {
    return MarketManager.create();
  }

  getNextCounter(marketId: string): bigint {
    const next = (this.liquidationCounter.get(marketId) ?? 0n) + 1n;
    this.liquidationCounter.set(marketId, next);
    return next;
  }

  getCounters(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [marketId, c] of this.liquidationCounter) {
      result[marketId] = c.toString();
    }
    return result;
  }

  setCounters(counters: Record<string, string>) {
    for (const [marketId, c] of Object.entries(counters)) {
      this.liquidationCounter.set(marketId, BigInt(c));
    }
  }

  async updateMarkPrice(price: bigint, marketId: string) {
    const market = this.getMarketManager().getMarket(marketId);
    if (!market) {
      console.log('market does not exist');
      return;
    }

    const lp = price;
    let longsLpsBelowMarkPrice = market.longsTree.findBelow(lp);
    if (!longsLpsBelowMarkPrice) {
    } else {
      for (const lp of longsLpsBelowMarkPrice) {
        const levelData = market.longs.get(lp);
        if (levelData === undefined) {
          console.log('lp in tree but no positons at lp');
          continue;
        }
        const positionsList = levelData.list;
        let position: Node<Position> | null = positionsList.getFirstOrder();

        while (position != null) {
          if (position === null) break;
          if (position.value.state === 'LIQUIDATING') {
            position = position.right;
            continue;
          }

          const counter = this.getNextCounter(market.marketId);
          const payload = {
            userId: position.value.userId,
            marketId: market.marketId,
            type: 'MARKET',
            side: 'SHORT',
            qty: position.value.qty,
            leverage: '1',
            liquidationId: `lqOrder:${market.marketId}:${counter}`,
          };
          position.value.state = 'LIQUIDATING';
          try {
            await sender.xAdd('engine-stream', '*', {
              type: 'CREATE_ORDER',
              corelationId: generateId(),
              payload: JSON.stringify(payload),
            });
          } catch (error) {
            position.value.state = 'OPEN';
            console.log('error on sending the liquidation request to the engine-stream');
          }
          position = position.right;
        }
      }
    }

    //liquidate the short positions
    let shortsLpsBelowMarkPrice = market.shortsTree.findAbove(lp);
    if (!shortsLpsBelowMarkPrice) {
    } else {
      for (const lp of shortsLpsBelowMarkPrice) {
        const levelData = market.shorts.get(lp);
        if (levelData === undefined) {
          console.log('lp in tree but no positons at lp');
          continue;
        }
        const positionsList = levelData.list;
        let position: Node<Position> | null = positionsList.getFirstOrder();

        while (position != null) {
          if (position === null) break;
          if (position.value.state === 'LIQUIDATING') {
            position = position.right;
            continue;
          }
          position.value.state = 'LIQUIDATING';
          const counter = this.getNextCounter(market.marketId);
          const payload = {
            userId: position.value.userId,
            marketId: market.marketId,
            type: 'MARKET',
            side: 'LONG',
            qty: position.value.qty,
            leverage: '1',
            liquidationId: `lqOrder:${market.marketId}:${counter}`,
          };
          try {
            await sender.xAdd('engine-stream', '*', {
              type: 'CREATE_ORDER',
              corelationId: generateId(),
              payload: JSON.stringify(payload),
            });
          } catch (error) {
            position.value.state = 'OPEN';
            console.log('error on sending the liquidation request to the engine-stream');
          }
          position = position.right;
        }
      }
    }
    console.log('all possible liquidations happend triggered:');
  }
}

export { LiquidationEngine };

