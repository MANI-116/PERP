import type { CreateOrderRequest, EngineResponse } from '@repo/types';
import { Order } from '../structures/order';

export function rejectOrderResponse(
  error: string,
  payload: CreateOrderRequest,
): EngineResponse {
  return {
    event: 'ORDER_REJECTED',
    eventId: '0',
    payload: {
      error: error,
      timestamp: Date.now().toString(),
      orderId: payload.orderId,
      userId: payload.userId,
      marketId: payload.marketId,
      side: payload.side,
      type: payload.type,
      qty: payload.qty.toString(),
      price: payload.price.toString(),
      leverage: payload.leverage.toString(),
      filled: '0n',
      state: 'CANCELED',
    },
  } as EngineResponse;
}

export function acceptOrderResponse(
  order: Order,
  updates: { asks: string[][]; bids: string[][] },
): EngineResponse {
  return {
    event: 'ORDER_ACCEPTED',
    eventId: '0',
    payload: {
      type: order.type,
      qty: order.qty.toString(),
      price: order.price.toString(),
      state: order.status,
      userId: order.userId,
      filled: 0n.toString(),
      side: order.side,
      marketId: order.assetId,
      orderId: order.orderId,
      message: 'order placed fully in the book',
      timestamp: Date.now().toString(),
      updates: updates,
    },
  } as EngineResponse;
}
