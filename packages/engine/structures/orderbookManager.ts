import { OrderBook, type UserManager } from '.';
import type { MarketManager } from './marketManager';
import { z } from 'zod';

const orderBookManagerSnapshotSchema = z.object({
  orderBooks: z.array(
    z.object({
      orderBookSnapshotString: z.string(),
      marketId: z.string(),
    }),
  ),
});
export class OrderBookManager {
  private static instance: OrderBookManager | null = null;
  private orderBooks: Map<string, OrderBook>;

  private constructor(
    private marketManager: MarketManager,
    private userManager: UserManager,
  ) {
    this.orderBooks = new Map<string, OrderBook>();
  }

  static create(marketManager: MarketManager, userManager: UserManager): OrderBookManager {
    if (OrderBookManager.instance) {
      return OrderBookManager.instance;
    }
    OrderBookManager.instance = new OrderBookManager(marketManager, userManager);
    return OrderBookManager.instance;
  }

  addOrderbook(marketId: string, orderbook: OrderBook) {
    this.orderBooks.set(marketId, orderbook);
  }

  giveSnapshot() {
    const snapshots = Array.from(this.orderBooks.entries()).map(([marketId, orderBook]) => {
      const orderBookSnapshortString = orderBook.giveSnapshot();
      return JSON.stringify({ marketId, orderBookSnapshortString });
    });

    return JSON.stringify({
      orderBooks: snapshots,
    });
  }

  static createFromSnapshot(
    snapshot: string,
    marketManager: MarketManager,
    userManager: UserManager,
  ): OrderBookManager | null {
    // recovery
    const parsed = orderBookManagerSnapshotSchema.safeParse(JSON.parse(snapshot));

    if (!parsed.success) {
      return null;
    }

    const orderBookManager = OrderBookManager.create(marketManager, userManager);

    for (const snapshot of parsed.data.orderBooks) {
      const market = marketManager.getMarket(snapshot.marketId);
      if (!market) return null;

      const orderBook = OrderBook.createFromSnapshot(snapshot.orderBookSnapshotString, market);

      if (!orderBook) {
        return null;
      }

      orderBookManager.addOrderbook(market.marketId, orderBook);
    }

    return orderBookManager;
  }
}
