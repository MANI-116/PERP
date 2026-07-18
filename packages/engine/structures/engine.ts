import { z } from 'zod';
import crypto from 'crypto';
import { UserManager } from './userManager';
import { MarketManager } from './marketManager';
import type {
  CreateOrderRequest,
  EngineResponse,
  MatchOrder,
} from '@repo/types';
import type { Market } from './market';
import { Order } from './order';
import { rejectOrderResponse, acceptOrderResponse } from '../lib/placeOrderResponses';

const SNAPSHOT_VERSION = 1;

const engineSnapshotschema = z.object({
  schemaVersion: z.number(),
  checksum: z.string(),
  coreData: z.string(),
});

export class Engine {
  private userManager: UserManager;
  private marketManager: MarketManager;
  private static engine: Engine | null;
  private exchangeMarketBalance = 0n;
  private currentEventId = 0n;
  liquidationCounters = new Map<string, bigint>();

  static readonly SNAPSHOT_VERSION = SNAPSHOT_VERSION;

  static reset() {
    Engine.engine = null;
  }

  constructor() {
    this.userManager = UserManager.create();
    this.marketManager = MarketManager.create();
  }

  static create() {
    if (Engine.engine) {
      return Engine.engine;
    }
    Engine.engine = new Engine();
    return Engine.engine;
  }

  getNextEventId(): bigint {
    this.currentEventId += 1n;
    return this.currentEventId;
  }

  getLastEventId(): bigint {
    return this.currentEventId;
  }

  setEventId(id: bigint) {
    this.currentEventId = id;
  }

  setLiquidationCounters(counters: Record<string, string>) {
    for (const [marketId, counter] of Object.entries(counters)) {
      this.liquidationCounters.set(marketId, BigInt(counter));
    }
  }

  getLiquidationCountersForSnapshot(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [marketId, counter] of this.liquidationCounters) {
      result[marketId] = counter.toString();
    }
    return result;
  }

  private static computeChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  getSnapshot() {
    const userManagerSnapshot = this.userManager.giveSnapshot();
    const marketManagerSnapshot = this.marketManager.giveSnapshot();
    const coreData = JSON.stringify({
      userManagerSnapshot,
      marketManagerSnapshot,
      lastEventId: this.currentEventId.toString(),
      liquidationCounters: this.getLiquidationCountersForSnapshot(),
      exchangeMarketBalance: this.exchangeMarketBalance.toString(),
    });
    return JSON.stringify({
      schemaVersion: SNAPSHOT_VERSION,
      checksum: Engine.computeChecksum(coreData),
      coreData,
    });
  }

  static createFromSnapshot(snapshotString: string) {
    const parseData = engineSnapshotschema.safeParse(JSON.parse(snapshotString));
    if (!parseData.success) {
      console.log('snapshot validation failed:', parseData.error);
      return null;
    }
    const snapshot = parseData.data;

    // Version check
    if (snapshot.schemaVersion > SNAPSHOT_VERSION) {
      console.log('snapshot version', snapshot.schemaVersion, '> engine version', SNAPSHOT_VERSION);
      return null;
    }

    // Checksum validation
    const expectedChecksum = Engine.computeChecksum(snapshot.coreData);
    if (snapshot.checksum !== expectedChecksum) {
      console.log('snapshot checksum mismatch: expected', expectedChecksum, 'got', snapshot.checksum);
      return null;
    }

    // Parse coreData to get the actual fields
    let parsed: {
      userManagerSnapshot: string;
      marketManagerSnapshot: string;
      lastEventId: string;
      liquidationCounters: Record<string, string>;
      exchangeMarketBalance: string;
    };
    try {
      parsed = JSON.parse(snapshot.coreData);
    } catch {
      console.log('snapshot: failed to parse coreData');
      return null;
    }

    const engine = Engine.create();
    const marketManager = MarketManager.createFromSnapshot(parsed.marketManagerSnapshot);
    if (!marketManager) return null;
    const userManager = UserManager.createFromSnapshot(parsed.userManagerSnapshot);
    if (!userManager) return null;
    engine.userManager = userManager;
    engine.marketManager = marketManager;
    engine.currentEventId = BigInt(parsed.lastEventId);
    engine.setLiquidationCounters(parsed.liquidationCounters);
    engine.exchangeMarketBalance = BigInt(parsed.exchangeMarketBalance);
    return engine;
  }

  handleBankRuptcy(position: string, amount: bigint) {
    this.exchangeMarketBalance -= amount;
    if (this.exchangeMarketBalance < 0) {
      //TODO ---> perform ADL
    }
  }

  matchOrderExecution(makerOrder: MatchOrder, market: Market) {
    const response = this.userManager.getPosition(makerOrder.userId, market.marketId);
    if (!response.success && response.error === 'user not found') {
      throw new Error('user not found');
    }
    if (!response.success) {
      const initialMargin = (makerOrder.price * makerOrder.qtyTransfered) / makerOrder.leverage;
      const debitRes = this.userManager.debitLockAmount(makerOrder.userId, initialMargin);
      if (!debitRes.success) {
        throw new Error('locked balance logic got skewed');
      }
      const { positionId } = market.createPosition(
        makerOrder.userId,
        makerOrder.qtyTransfered,
        makerOrder.price,
        makerOrder.side,
        initialMargin,
      );
      this.userManager.addPosition(makerOrder.userId, market.marketId, positionId);
      const tax = market.calculatetax(makerOrder.qtyTransfered * makerOrder.price, 'maker');
      makerOrder.tax = tax;
      const taxcutResponse = market.cutInitialMargin(positionId, tax);
      if (!taxcutResponse.success) {
        this.handleBankRuptcy(positionId, tax);
      }
      this.exchangeMarketBalance += tax;
    } else {
      let makerPositionId = response.positionId!;
      const tax = market.calculatetax(makerOrder.qtyTransfered * makerOrder.price, 'maker');
      makerOrder.tax = tax;
      const taxcutResponse = market.cutInitialMargin(makerPositionId, tax);
      if (!taxcutResponse.success) {
        this.handleBankRuptcy(makerPositionId, tax);
      }
      this.exchangeMarketBalance += tax;
      const getData = market.getData(makerPositionId, { keys: ['avgPrice', 'side', 'initialMargin', 'qty', 'id'] });
      if (!getData.success) return getData;
      if (!getData.data) return getData;
      const { initialMargin: makerMargin, side: makerSide, qty: makerQty, avgPrice: makerPrice } = getData.data;

      market.updatePositions(
        response.positionId!,
        makerOrder.side,
        makerOrder.userId,
        makerOrder.price,
        makerOrder.leverage,
        makerOrder.qtyTransfered,
      );
      const notionalAmount = makerOrder.qtyTransfered * makerOrder.price;
      if (makerOrder.side === makerSide) {
        const extraMargin = notionalAmount / makerOrder.leverage;
        const debitRes = this.userManager.debitLockAmount(makerOrder.userId, extraMargin);
        if (!debitRes.success) {
          throw new Error('locked balance logic got skewed');
        }
      } else {
        if (makerQty >= makerOrder.qtyTransfered) {
          const direction = makerSide === 'SHORT' ? -1n : 1n;
          const realizedPnL = (makerOrder.price - makerPrice) * makerOrder.qtyTransfered * direction;
          const releasedMargin = (makerMargin * makerOrder.qtyTransfered) / makerQty;
          const settlementAmount = releasedMargin + realizedPnL;
          if (settlementAmount < 0) {
            return this.handleBankRuptcy(makerPositionId, settlementAmount);
          }
          this.userManager.rampUser(makerOrder.userId, settlementAmount);
        } else {
          const direction = makerSide === 'SHORT' ? -1n : 1n;
          const realizedPnL = (makerOrder.price - makerPrice) * makerQty * direction;
          const releasedMargin = makerMargin;
          const settlementAmount = releasedMargin + realizedPnL;
          if (settlementAmount < 0) {
            this.handleBankRuptcy(makerPositionId, settlementAmount);
            return { success: false, reason: 'INSUFFICIENT_MARGIN_AFTER_REALIZATION' };
          }
          this.userManager.rampUser(makerOrder.userId, settlementAmount);
          const openingQty = makerOrder.qtyTransfered - makerQty;
          const initialMargin = (openingQty * makerOrder.price) / makerOrder.leverage;
          const debitRes = this.userManager.debitLockAmount(makerOrder.userId, initialMargin);
          if (!debitRes.success) {
            throw new Error('locked balance logic got skewed');
          }
          const { positionId } = market.createPosition(
            makerOrder.userId,
            openingQty,
            makerOrder.price,
            makerOrder.side,
            initialMargin,
          );
          this.userManager.addPosition(makerOrder.userId, market.marketId, positionId);
        }
      }
    }
  }

  lockMargin(
    payload: CreateOrderRequest,
    market: Market,
  ): { success: false; error: string } | { success: true; message: string } {
    if (payload.leverage <= 0n) {
      return { success: false, error: 'leverage must be greater than 0' };
    }
    const sameMarketPosition = this.userManager.getPosition(payload.userId, market.marketId);
    if (sameMarketPosition.success) {
      const getdataRes = market.getData(sameMarketPosition.positionId, { keys: ['side', 'qty', 'state'] });
      if (!getdataRes.success) {
        return { success: false, error: 'market unable to get side from the market' };
      }
      const { side, qty: positionQty, state } = getdataRes.data!;
      if (state === 'LIQUIDATING') {
        return { success: false, error: 'position in liquidating state cannot lock balances' };
      }
      if (payload.side === side) {
        let positionSize = 0n;
        if (payload.type === 'MARKET') {
          const estimatedPrice = market.calculateEstimatedPrice(payload.qty, payload.side);
          if (estimatedPrice === 0n) return { success: false, error: 'unable to lock the balace' };
          if (estimatedPrice === undefined) return { success: false, error: 'unable to get the estimated price' };
          positionSize = payload.qty * estimatedPrice;
        } else {
          positionSize = payload.qty * payload.price;
        }
        const initialMargin = positionSize / payload.leverage;
        if (!this.userManager.lockAmount(payload.userId, initialMargin)) {
          return { success: false, error: 'does not have enough balace' };
        }
        return { success: true, message: 'locked the margin' };
      } else {
        const openingQty = payload.qty - positionQty;
        const initialMargin = (openingQty * payload.price) / payload.leverage;
        if (!this.userManager.lockAmount(payload.userId, initialMargin)) {
          return { success: false, error: 'does not have enough balace' };
        }
        return { success: true, message: 'locked the margin' };
      }
    } else {
      let positionSize = 0n;
      if (payload.type === 'MARKET') {
        const estimatedPrice = market.calculateEstimatedPrice(payload.qty, payload.side);
        if (estimatedPrice === 0n) return { success: false, error: 'unable to lock the balace' };
        if (estimatedPrice === undefined) return { success: false, error: 'unable to get the estimated price' };
        positionSize = payload.qty * estimatedPrice;
      } else {
        positionSize = payload.qty * payload.price;
      }
      const initialMargin = positionSize / payload.leverage;
      if (!this.userManager.lockAmount(payload.userId, initialMargin)) {
        return { success: false, error: 'does not have enough balace' };
      }
      return { success: true, message: 'locked the margin' };
    }
  }

  placeLimitOrder(payload: CreateOrderRequest, market: Market): EngineResponse {
    console.log("placing limit order-")
    const lockres = this.lockMargin(payload, market);
    if (!lockres.success) {
      return rejectOrderResponse(lockres.error, payload);
    }

    const order = new Order(
      payload.orderId, payload.userId, payload.marketId,
      payload.qty, payload.side, payload.price, payload.leverage, 'LIMIT',
    );

    const response = market.orderbook.matchOrder(order) as {
      event: string;
      payload: any;
    };
    if (response.event === 'ORDER_ACCEPTED') {
      const { updates } = response.payload;
      return acceptOrderResponse(order, updates);
    }
    const matchedOrders = response.payload.matchedOrders;
    if (!matchedOrders) throw new Error('orderfilled/partially is skewed');

    matchedOrders.forEach((matchOrder: MatchOrder) => {
      this.matchOrderExecution(matchOrder, market);
    });

    this.matchOrderExecution(
      {
        orderId: order.orderId, price: order.price, userId: order.userId,
        qtyTransfered: order.filled, timestamp: Date.now().toString(),
        leverage: order.leverage, side: order.side, tax: 0n,
      },
      market,
    );

    return filledResponse(
      {
        ...response,
        event: `${response.event === 'ORDER_FILLED' ? 'ORDER_FILLED' : 'ORDER_FILLED_PARTIALLY'}`,
        payload: { ...response.payload, matchedOrders },
      } as any,
      order,
      market,
    );
  }

  placeMarketOrder(payload: CreateOrderRequest, market: Market): EngineResponse {
    const lockres = this.lockMargin(payload, market);
    if (!lockres.success) {
      return rejectOrderResponse(lockres.error, payload);
    }

    const order = new Order(
      payload.orderId, payload.userId, payload.marketId,
      payload.qty, payload.side, 0n, payload.leverage, 'MARKET',
    );
    const response = market.orderbook.matchMarketOrder(order) as {
      event: string;
      payload: any;
    };

    if (response.event === 'ORDER_REJECTED') {
      return response as any;
    }
    const matchedOrders = response.payload.matchedOrders;
    if (!matchedOrders) throw new Error('orderfilled partially is skewed');

    matchedOrders.forEach((matchOrder: MatchOrder) => {
      this.matchOrderExecution(matchOrder, market);
    });

    this.matchOrderExecution(
      {
        orderId: order.orderId, price: order.price, userId: order.userId,
        qtyTransfered: BigInt(response.payload.filled), timestamp: Date.now().toString(),
        leverage: order.leverage, side: order.side, tax: 0n,
      },
      market,
    );

    return filledResponse(response as any, order, market);
  }

  placeOrder(payload: CreateOrderRequest): EngineResponse {
    const eventId = this.getNextEventId().toString();

    // Liquidation replay guard: skip if this liquidation was already processed
    if (payload.liquidationId) {
      const parts = payload.liquidationId.split(':');
      // format: "lqOrder:{marketId}:{counter}"
      const liqMarketId = parts[1];
      const liqCounterStr = parts[2];
      if (!liqMarketId || !liqCounterStr) {
        return { ...rejectOrderResponse('malformed liquidationId', payload), eventId };
      }
      const liqCounter = BigInt(liqCounterStr);
      const lastCounter = this.liquidationCounters.get(liqMarketId)!;
      if (lastCounter !== undefined && liqCounter <= lastCounter) {
        return { ...rejectOrderResponse('already liquidated on replay', payload), eventId };
      }
      this.liquidationCounters.set(liqMarketId, liqCounter);
    }

    const market = this.marketManager.getMarket(payload.marketId);
    const user = this.userManager.foundUser(payload.userId);
    if (user === undefined) {
      return { ...rejectOrderResponse('user not found', payload), eventId };
    }
    if (market === undefined) {
      return { ...rejectOrderResponse('market not found', payload), eventId };
    }

    if (payload.type === 'LIMIT') {
      return { ...this.placeLimitOrder(payload, market), eventId };
    }
    return { ...this.placeMarketOrder(payload, market), eventId };
  }
}

function filledResponse(
  payload: {
    event: 'ORDER_FILLED' | 'ORDER_FILLED_PARTIALLY';
    payload: {
      filled: bigint;
      matchedOrders: MatchOrder[];
      updates: { uid: number; bids: string[][]; asks: string[][] };
    };
  },
  order: Order,
  market: Market,
): EngineResponse {
  const takerTax = market.calculatetax(BigInt(payload.payload.filled) * order.price, 'taker');
  return {
    event: payload.event,
    eventId: '0',
    payload: {
      matchedOrders: payload.payload.matchedOrders.map((m) => ({
        ...m,
        price: m.price.toString(),
        leverage: m.leverage.toString(),
        qtyTransfered: m.qtyTransfered.toString(),
        tax: m.tax.toString(),
      })),
      tax: takerTax.toString(),
      updates: payload.payload.updates,
      ...order,
      leverage: order.leverage.toString(),
      maintenanceMargin: order.maintenanceMargin.toString(),
      initialMargin: order.initialMargin.toString(),
      filled: payload.payload.filled.toString(),
      state: `${payload.event === 'ORDER_FILLED' ? 'FILLED' : 'PARTIALLY_FILLED'}`,
      marketId: order.assetId,
      qty: order.qty.toString(),
      price: order.price.toString(),
    },
  };
}
