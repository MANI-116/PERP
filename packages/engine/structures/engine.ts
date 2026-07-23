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
  private exchangeMarketBalance = 100000000n;

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
    console.log("exchange balance:",this.exchangeMarketBalance);
    console.log("handling bankruptsy-",amount);
    this.exchangeMarketBalance += amount;
    if (this.exchangeMarketBalance < 0) {
      console.log("handling ADL", this.exchangeMarketBalance);
      //TODO ---> perform ADL
    }
  }

  matchOrderExecution(makerOrder: MatchOrder, market: Market): bigint {
    let debitedAmount = 0n;

    const response = this.userManager.getPosition(makerOrder.userId, market.marketId);
    if (!response.success && response.error === 'user not found') {
      throw new Error('user not found');
    }

    //postition not found
    if (!response.success) {
      console.log("new position creation")
      const initialMargin = (makerOrder.price * makerOrder.qtyTransfered) / makerOrder.leverage;
      const debitRes = this.userManager.debitLockAmount(makerOrder.userId, initialMargin);
      if (!debitRes.success) {
        throw new Error('locked balance logic got skewed');
      }
      debitedAmount = initialMargin;

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

      //[skewed logic]
      const taxcutResponse = market.cutInitialMargin(positionId, tax);
      if (!taxcutResponse.success) {
        this.handleBankRuptcy(positionId, tax);
      }
        this.exchangeMarketBalance += tax;
      

    } else {

      //position found need to update the existing position
      console.log(" update position -")

      //tax logic
      let makerPositionId = response.positionId!;
      const tax = market.calculatetax(makerOrder.qtyTransfered * makerOrder.price, 'maker');
      makerOrder.tax = tax;
      const taxcutResponse = market.cutInitialMargin(makerPositionId, tax);
      if (!taxcutResponse.success) {
        this.handleBankRuptcy(makerPositionId, tax);
        
      }

        this.exchangeMarketBalance += tax;
      

      //update postion logic
      const getData = market.getData(makerPositionId, { keys: ['avgPrice', 'side', 'initialMargin', 'qty', 'id'] });
      if (!getData.success) throw new Error('market position data fetch failed');
      if (!getData.data) throw new Error('market position data missing');
      const { initialMargin: makerMargin, side: makerSide, qty: makerQty, avgPrice: makerPrice } = getData.data;

      market.updatePositions(
        response.positionId!,
        makerOrder.side,
        makerOrder.userId,
        makerOrder.price,
        makerOrder.leverage,
        makerOrder.qtyTransfered,
      );

      // Cleanup closed positions
      if (!market.positionsRef.has(response.positionId!)) {
        this.userManager.removePosition(makerOrder.userId, market.marketId);
      }

      const notionalAmount = makerOrder.qtyTransfered * makerOrder.price;

      //same side update
      if (makerOrder.side === makerSide) {
        console.log("same side update-");
        const extraMargin = notionalAmount / makerOrder.leverage;
        const debitRes = this.userManager.debitLockAmount(makerOrder.userId, extraMargin);

        if (!debitRes.success) {
          throw new Error('locked balance logic got skewed');
        }
        debitedAmount = extraMargin;
      } else {

        //opposite side update
        console.log("opposite side update with no reversal")
     
        if (makerQty >= makerOrder.qtyTransfered) {
             //no reversal
           const direction = makerSide === 'SHORT' ? -1n : 1n;
          const realizedPnL = (makerOrder.price - makerPrice) * makerOrder.qtyTransfered * direction;
          const releasedMargin = (makerMargin * makerOrder.qtyTransfered) / makerQty;
          const settlementAmount = releasedMargin + realizedPnL;
          if (settlementAmount < 0) {
            this.handleBankRuptcy(makerPositionId, settlementAmount);
          } else if (settlementAmount > 0n) {
            this.userManager.rampUser(makerOrder.userId, settlementAmount);
          }
        } else {

          //reversal
          
          console.log("opposite side reversal with reversal-")
          const direction = makerSide === 'SHORT' ? -1n : 1n;
          const realizedPnL = (makerOrder.price - makerPrice) * makerQty * direction;
          const releasedMargin = makerMargin;
          const settlementAmount = releasedMargin + realizedPnL;
          if (settlementAmount < 0) {
            this.handleBankRuptcy(makerPositionId, settlementAmount);
          } else if (settlementAmount > 0n) {
            this.userManager.rampUser(makerOrder.userId, settlementAmount);
          }
          const openingQty = makerOrder.qtyTransfered - makerQty;
          const initialMargin = (openingQty * makerOrder.price) / makerOrder.leverage;
          const debitRes = this.userManager.debitLockAmount(makerOrder.userId, initialMargin);
          if (!debitRes.success) {
            throw new Error('locked balance logic got skewed');
          }
          debitedAmount = initialMargin;
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
    return debitedAmount;
  }

  lockMargin(
    payload: CreateOrderRequest,
    market: Market,
  ): { success: false; error: string } | { success: true; message: string; openingQty: bigint; lockedAmount: bigint } {

    if (payload.leverage <= 0n) {
      return { success: false, error: 'leverage must be greater than 0' };
    }

    const sameMarketPosition = this.userManager.getPosition(payload.userId, market.marketId);

    //existing position found for the user
    if (sameMarketPosition.success) {

      const getdataRes = market.getData(sameMarketPosition.positionId, { keys: ['side', 'qty', 'state'] });

      if (!getdataRes.success) {
        return { success: false, error: '[CRITICAL] POSTION FOUND BUT NOT ABLE TO GET ITS DATE FROM THE MARKET' };
      }

      const { side, qty: positionQty, state } = getdataRes.data!;

      if (state === 'LIQUIDATING') {
        return { success: false, error: 'position in liquidating state cannot lock balances' };
      }
      if (payload.side === side) {
        let positionSize = 0n;
        if (payload.type === 'MARKET') {
          const estimatedPrice = market.calculateEstimatedPrice(payload.qty, payload.side);
          if (estimatedPrice === 0n) return { success: false, error: 'insufficient liquidity for market order' };
          if (estimatedPrice === undefined) return { success: false, error: 'unable to get the estimated price' };
          positionSize = payload.qty * estimatedPrice;
        } else {
          positionSize = payload.qty * payload.price;
        }
        const initialMargin = positionSize / payload.leverage;
        if (!this.userManager.lockAmount(payload.userId, initialMargin)) {
          return { success: false, error: 'does not have enough balace' };
        }
        return { success: true, message: 'locked the margin', openingQty: payload.qty, lockedAmount: initialMargin };
      } else {
        const openingQty = payload.qty - positionQty;
        let initialMargin = 0n;
        if (openingQty > 0n) {
          let positionSize = 0n;
          if (payload.type === 'MARKET') {
            const estimatedPrice = market.calculateEstimatedPrice(payload.qty, payload.side);
            if (estimatedPrice === 0n) return { success: false, error: 'insufficient liquidity for market order' };
            if (estimatedPrice === undefined) return { success: false, error: 'unable to get the estimated price' };
            positionSize = openingQty * estimatedPrice;
          } else {
            positionSize = openingQty * payload.price;
          }
          initialMargin = positionSize / payload.leverage;
          if (!this.userManager.lockAmount(payload.userId, initialMargin)) {
            return { success: false, error: 'does not have enough balace' };
          }
        }
        return { success: true, message: 'locked the margin', openingQty: openingQty > 0n ? openingQty : 0n, lockedAmount: initialMargin };
      }
    } else {

      //create new order request

      let positionSize = 0n;
      if (payload.type === 'MARKET') {
        const estimatedPrice = market.calculateEstimatedPrice(payload.qty, payload.side);
        if (estimatedPrice === 0n) return { success: false, error: 'insufficient liquidity for market order' };
        if (estimatedPrice === undefined) return { success: false, error: 'unable to get the estimated price' };
        positionSize = payload.qty * estimatedPrice;
      } else {
        positionSize = payload.qty * payload.price;
      }
      const initialMargin = positionSize / payload.leverage;
      if (!this.userManager.lockAmount(payload.userId, initialMargin)) {
        return { success: false, error: 'does not have enough balace' };
      }
      return { success: true, message: 'locked the margin', openingQty: payload.qty, lockedAmount: initialMargin };
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
      payload.qty, payload.side, payload.price, payload.leverage, 'LIMIT', lockres.openingQty
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

    console.log("'executing the matched orders-",matchedOrders);

    matchedOrders.forEach((matchOrder: MatchOrder) => {
      this.matchOrderExecution(matchOrder, market);
    });

    console.log("updating resting order to positions is completed and starting the limit order updation")
    let totalTakerDebited = 0n;
    matchedOrders.forEach((matchOrder: MatchOrder) => {
      totalTakerDebited += this.matchOrderExecution(
        {
          orderId: order.orderId, price: matchOrder.price, userId: order.userId,
          qtyTransfered: matchOrder.qtyTransfered, timestamp: Date.now().toString(),
          leverage: order.leverage, side: order.side, tax: 0n,
        },
        market,
      );
    });
    console.log("updating the limit order itself is done");

    const remainingQty = order.qty - order.filled;
    const unfilledOpeningQty = remainingQty < lockres.openingQty ? remainingQty : lockres.openingQty;
    const expectedRemainingLocked = lockres.openingQty > 0n ? (unfilledOpeningQty * lockres.lockedAmount) / lockres.openingQty : 0n;
    const excessMargin = lockres.lockedAmount - totalTakerDebited - expectedRemainingLocked;
    if (excessMargin > 0n) {
      this.userManager.unlockAmount(order.userId, excessMargin);
    }

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
      payload.qty, payload.side, 0n, payload.leverage, 'MARKET', lockres.openingQty
    );
    const response = market.orderbook.matchMarketOrder(order) as {
      event: string;
      payload: any;
    };

    if (response.event === 'ORDER_REJECTED') {
      this.userManager.unlockAmount(payload.userId, lockres.lockedAmount);
      return response as any;
    }
    const matchedOrders = response.payload.matchedOrders;
    if (!matchedOrders) throw new Error('orderfilled partially is skewed');

    matchedOrders.forEach((matchOrder: MatchOrder) => {
      this.matchOrderExecution(matchOrder, market);
    });

    let totalTakerDebited = 0n;
    matchedOrders.forEach((matchOrder: MatchOrder) => {
      totalTakerDebited += this.matchOrderExecution(
        {
          orderId: order.orderId, price: matchOrder.price, userId: order.userId,
          qtyTransfered: matchOrder.qtyTransfered, timestamp: Date.now().toString(),
          leverage: order.leverage, side: order.side, tax: 0n,
        },
        market,
      );
    });

    if (response.event === 'ORDER_FILLED_PARTIALLY') {
      const remainingQty = order.qty - BigInt(response.payload.filled);
      const unfilledOpeningQty = remainingQty < lockres.openingQty ? remainingQty : lockres.openingQty;
      const expectedRemainingLocked = lockres.openingQty > 0n ? (unfilledOpeningQty * lockres.lockedAmount) / lockres.openingQty : 0n;
      const excessMargin = lockres.lockedAmount - totalTakerDebited - expectedRemainingLocked;
      if (excessMargin > 0n) {
        this.userManager.unlockAmount(order.userId, excessMargin);
      }
    } else {
      const excessMargin = lockres.lockedAmount - totalTakerDebited;
      if (excessMargin > 0n) {
        this.userManager.unlockAmount(order.userId, excessMargin);
      }
    }

    return filledResponse(response as any, order, market);
  }

  placeOrder(requestOrder: CreateOrderRequest): EngineResponse {
    console.log("placing order-",requestOrder);

    if(requestOrder.leverage === 0n || requestOrder.qty === 0n){
      return rejectOrderResponse("invalid constraints",requestOrder);
    }
    const eventId = this.getNextEventId().toString();

    // Liquidation replay guard: skip if this liquidation was already processed
    if (requestOrder.liquidationId) {
      const parts = requestOrder.liquidationId.split(':');
      // format: "lqOrder:{marketId}:{counter}"
      const liqMarketId = parts[1];
      const liqCounterStr = parts[2];
      if (!liqMarketId || !liqCounterStr) {
        return { ...rejectOrderResponse('malformed liquidationId', requestOrder), eventId };
      }
      const liqCounter = BigInt(liqCounterStr);
      const lastCounter = this.liquidationCounters.get(liqMarketId)!;
      if (lastCounter !== undefined && liqCounter <= lastCounter) {
        return { ...rejectOrderResponse('already liquidated on replay', requestOrder), eventId };
      }
      this.liquidationCounters.set(liqMarketId, liqCounter);
    }

  

    const market = this.marketManager.getMarket(requestOrder.marketId);
    if (market === undefined) {
      return { ...rejectOrderResponse('market not found', requestOrder), eventId };
    }
    const user = this.userManager.foundUser(requestOrder.userId);
    if (user === undefined) {
      return { ...rejectOrderResponse('user not found', requestOrder), eventId };
    }

    if (requestOrder.type === 'LIMIT') {
      return { ...this.placeLimitOrder(requestOrder, market), eventId };
    }
    return { ...this.placeMarketOrder(requestOrder, market), eventId };
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
      originalOpeningQty: order.originalOpeningQty.toString(),
      leverage: order.leverage.toString(),
      initialMargin: order.initialMargin.toString(),
      filled: payload.payload.filled.toString(),
      state: `${payload.event === 'ORDER_FILLED' ? 'FILLED' : 'PARTIALLY_FILLED'}`,
      marketId: order.assetId,
      qty: order.qty.toString(),
      price: order.price.toString(),
    },
  };
}
