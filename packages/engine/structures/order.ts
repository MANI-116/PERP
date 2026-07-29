import type { IMarket, OrderSide, OrderStatus, OrderType } from '@repo/types';
import { z } from 'zod';
import type { Id, GiveSnapshot } from '@repo/types';

const orderSnapshotSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  assetId: z.string(),
  qty: z.string().transform((p) => BigInt(p)),
  side: z.custom<OrderSide>(),
  price: z.string().transform((p) => BigInt(p)),
  leverage: z.string().transform((p) => BigInt(p)),
  type: z.custom<OrderType>(),
  status: z.custom<OrderStatus>(),
  filled: z.string().transform((p) => BigInt(p)),
  initialMargin: z.string().transform((p) => BigInt(p)),
  originalOpeningQty: z.string().transform((p) => BigInt(p)),
  reservedClosedQty:z.string().transform((p) => BigInt(p))
});

/**
 * order also will have reservedClosedQty:
 * snapshots to store it
 * recovery needs be there
 * close order ---> release qty
 * fills --> need to be consume the qty
 * 
 */
export class Order implements GiveSnapshot, Id {
  public initialMargin: bigint;
  public filled: bigint = 0n;
  public status: OrderStatus = 'OPEN';
  public id: string;
  public reservedClosedQty:bigint = 0n;
  constructor(
    public orderId: string,
    public userId: string,
    public assetId: string,
    public qty: bigint,
    public side: OrderSide,
    public price: bigint,
    public leverage: bigint,
    public type: OrderType,
    public originalOpeningQty: bigint,
  ) {
    this.id = orderId;
    if (this.orderId === '' || this.orderId === undefined) throw new Error('orderId is needed');
    this.initialMargin = (this.qty * this.price) / this.leverage;
  }
  giveSnapshot() {
    return JSON.stringify({
      orderId: this.orderId,
      userId: this.userId,
      assetId: this.assetId,
      qty: this.qty.toString(),
      side: this.side,
      price: this.price.toString(),
      leverage: this.leverage.toString(),
      type: this.type,
      status: this.status,
      filled: this.filled.toString(),
      initialMargin: this.initialMargin.toString(),
      originalOpeningQty: this.originalOpeningQty.toString(),
      reservedClosedQty:this.reservedClosedQty.toString()
    });
  }
  static createFromSnapshot(orderSnapshotString: string): Order | null {
    const parseData = orderSnapshotSchema.safeParse(JSON.parse(orderSnapshotString));
    if (!parseData.success) {
      return null;
    }
    const {
      orderId,
      userId,
      assetId,
      qty,
      side,
      price,
      leverage,
      type,
      initialMargin,
      status,
      originalOpeningQty,
      filled,
      reservedClosedQty
    } = parseData.data;
    const order = new Order(orderId, userId, assetId, qty, side, price, leverage, type, originalOpeningQty);
    order.status = status;
    order.initialMargin = initialMargin;
    order.filled = filled;
    order.reservedClosedQty = reservedClosedQty;
    return order;
  }
}
