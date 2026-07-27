import type {
  DeleteOrderResponse,
  CreateMarketResponse,
  RampUserResponse,
  EngineResponse,
  CreateUserResponse,
} from '@repo/types';
import { MarketManager, User, UserManager, Engine } from '@repo/engine-package';
import { LiquidationEngine } from './liquidationEngine';

const userManager = UserManager.create();
const marketManager = MarketManager.create();
const engine = Engine.create();

function getLiquidationEngine() {
  return LiquidationEngine.create();
}

function createUser(userId: string): CreateUserResponse {
  console.log('creating the user in the engine-', userId);
  const user = new User(userId);
  const response = userManager.addUser(user);
  return { ...response, userId };
}

function createMarket(marketId: string): CreateMarketResponse {
  return marketManager.addMarket({
    marketId,
    markPrice: 0n,
    mmr: 5n,
    takerRate: 5n,
    makerRate: 2n,
    taxationScale: 100n,
    symbol: 'SOLUSDT',
  });
}

function deleteOrder(orderId: string, marketId: string): DeleteOrderResponse {
  const market = marketManager.getMarket(marketId);
  if (!market) {
    return { success: false, error: 'orderbook not found', orderId, marketId };
  }
  const response = market.orderbook.deleteOrder(orderId) as any;
  if (response.success && response.order) {
    const order = response.order;
    const remainingQty = BigInt(order.qty) - BigInt(order.filled);
    const originalOpeningQty = BigInt(order.originalOpeningQty);
    const unfilledOpeningQty =
      remainingQty < originalOpeningQty ? remainingQty : originalOpeningQty;
    if (unfilledOpeningQty > 0n) {
      const refundAmount =
        (unfilledOpeningQty * BigInt(order.price)) / BigInt(order.leverage);
      userManager.unlockAmount(order.userId, refundAmount);
    }
  }
  console.log(response);
  return {
    success: response.success,
    updates: response.updates,
    orderId,
    marketId,
  };
}

function rampUser({
  userId,
  credit,
}: {
  userId: string;
  credit: bigint;
}): RampUserResponse {
  const response = userManager.rampUser(userId, credit*100_000_000n);
  return { ...response };
}

function getEquity(userId: string) {
  const response = userManager.getUserEquity(userId);
  return { ...response };
}

function getOpenPositions(userId: string) {
  const response = userManager.getPositions(userId);
  return response;
}

function getClosedPositions(userId: string) {
  const response = userManager.getClosedPositions(userId);
  return response;
}

export function engineManager(request: any): EngineResponse | null {
  request.payload = JSON.parse(request.payload);
  console.log('message from the sreams-', request);

  switch (request.type) {
    case 'CREATE_ORDER': {
      console.log('create order is invoked');
      const payload = {
        ...request.payload,
        price: request.payload.price ? BigInt(request.payload.price)*100_000_000n : 0n,
        qty: BigInt(request.payload.qty),
        leverage: BigInt(request.payload.leverage),
      };
      return engine.placeOrder(payload);
    }
    case 'CREATE_USER': {
      const { userId } = request.payload;
      const payload = createUser(userId);
      return {
        event: 'CREATE_USER',
        eventId: engine.getNextEventId().toString(),
        payload,
      };
    }

    case 'CREATE_MARKET': {
      const { marketId } = request.payload;
      const payload = createMarket(marketId);
      return {
        event: 'CREATE_MARKET',
        eventId: engine.getNextEventId().toString(),
        payload,
      };
    }
    case 'RAMP_USER': {
      const { userId, credit } = request.payload;
      const payload = rampUser({ userId, credit: BigInt(credit) });
      return {
        event: 'RAMP_USER',
        eventId: engine.getNextEventId().toString(),
        payload,
      };
    }
    case 'DELETE_ORDER': {
      const { orderId, marketId } = request.payload;
      const response = deleteOrder(orderId, marketId);
      return {
        event: 'DELETE_ORDER',
        eventId: engine.getNextEventId().toString(),
        payload: response,
      };
    }

    case 'GET_OPEN_POSITIONS': {
      const { userId } = request.payload;
      const response = getOpenPositions(userId);
      return {
        event: 'GET_OPEN_POSITIONS',
        eventId: engine.getNextEventId().toString(),
        payload: response,
      };
    }
    case 'GET_CLOSED_POSITIONS': {
      const { userId } = request.payload;
      const response = getClosedPositions(userId);
      return {
        event: 'GET_CLOSED_POSITIONS',
        eventId: engine.getNextEventId().toString(),
        payload: response,
      };
    }
    case 'GET_EQUITY': {
      const response = getEquity(request.payload.userId);
      return {
        event: 'GET_EQUITY',
        eventId: engine.getNextEventId().toString(),
        payload: response,
      };
    }
    case 'UPDATE_MARKPRICE':
      {
        const { symbol, markPrice } = request.payload;
        const market = marketManager.getMarket(symbol);
        if (market) {
          console.log('starting liquidation engine-', symbol);
          getLiquidationEngine().updateMarkPrice(
            BigInt(markPrice),
            market.marketId
          );
        }
      }
      break;
    case 'GET_DEPTH': {
      const { marketId } = request.payload;
      const response = getDepth(marketId);
      return {
        event: 'GET_DEPTH',
        eventId: engine.getNextEventId().toString(),
        payload: response,
      };
    }
    case 'RESTORE_SNAPSHOT':
      {
        const { snapshot, lastEventId, liquidationCounters } = request.payload;
        // Reset singletons so old state is garbage collected
        Engine.reset();
        MarketManager.reset();
        UserManager.reset();
        LiquidationEngine.reset();

        const restoredEngine = Engine.createFromSnapshot(snapshot);
        if (!restoredEngine) {
          return {
            event: 'RESTORE_SNAPSHOT',
            eventId: '0',
            payload: { success: false, error: 'snapshot restoration failed' },
          };
        }

        restoredEngine.setEventId(BigInt(lastEventId));
        restoredEngine.setLiquidationCounters(liquidationCounters);

        // Re-create the liquidation engine instance so it picks up the fresh MarketManager singleton
        LiquidationEngine.create();

        console.log('engine state restored from snapshot');
        return {
          event: 'RESTORE_SNAPSHOT',
          eventId: '0',
          payload: { success: true },
        };
      }
      break;
  }
  throw new Error('no request type matched');
}

function getDepth(marketId: string) {
  const market = marketManager.getMarket(marketId);
  if (!market) {
    return { success: false, error: 'no market found' };
  }

  const bids = [...market.orderbook.bids.entries()]
    .sort((a, b) => {
      if (a[0] < b[0]) {
        return -1;
      } else if (a[0] > b[0]) {
        return 1;
      }
      return 0;
    })
    .map((e) => {
      return [e[0].toString(), e[1].totalQty.toString()];
    });

  const asks = [...market.orderbook.asks.entries()]
    .sort((a, b) => {
      if (a[0] < b[0]) {
        return -1;
      } else if (a[0] > b[0]) {
        return 1;
      }
      return 0;
    })
    .map((e) => {
      return [e[0].toString(), e[1].totalQty.toString()];
    });

  return {
    success: true,
    data: { uidAtSnapshot: market.orderbook.getUpdateId() - 1, asks, bids },
  };
}
