import type { IMarket, OrderSide, PositionState } from '@repo/types';
import { z } from 'zod';
import type { Id, GiveSnapshot } from '@repo/types';

export const positionSnapshotSchema = z.object({
  userId: z.string(),
  qty: z.string().transform((p) => BigInt(p)),
  side: z.custom<OrderSide>(),
  id: z.string(),
  state: z.custom<PositionState>(),
  initialMargin: z.string().transform((p) => BigInt(p)),
  avgPrice: z.string().transform((p) => BigInt(p)),
  mmr: z.string().transform((p) => BigInt(p)),
  markPrice: z.string().transform((p) => BigInt(p)),
});
type PositionSnapshot = z.infer<typeof positionSnapshotSchema>;

export class Position implements GiveSnapshot, Id {
  public id: string;
  public state: PositionState = 'OPEN';
  public unrealizedPnL: bigint;
  public avgPrice: bigint;
  public liquidationPrice: bigint;
  private MMR_SCALE = 1000n;
  constructor(
    public userId: string,
    public qty: bigint,
    price: bigint,
    public side: OrderSide,
    public mmr: bigint,
    public markPrice: bigint,
    public initialMargin: bigint,
  ) {
    this.id = `${userId + Date.now() + Math.random() * 1e6}`;

    this.avgPrice = price;

    let direction = this.side === 'SHORT' ? 1n : -1n;
    this.unrealizedPnL = (this.markPrice - this.avgPrice) * this.qty * direction * -1n;

    this.liquidationPrice =
      (this.avgPrice * this.qty * this.MMR_SCALE + this.initialMargin * direction * this.MMR_SCALE) /
      (this.qty * (this.MMR_SCALE + direction * this.mmr));
  }
  reduceMargin(amount: bigint) {
    if (this.initialMargin <= amount) {
      return { success: false, error: 'not enough margins' };
    }
    this.initialMargin -= amount;
    return { success: true };
  }

  giveSnapshot() {
    //things need to create the state
    //userId,marketId,qty,side,id,state,initialMargin,avgPrice
    const snapshot = {
      userId: this.userId,
      qty: this.qty.toString(),
      side: this.side,
      id: this.id,
      state: this.state,
      initialMargin: this.initialMargin.toString(),
      avgPrice: this.avgPrice.toString(),
      markPrice: this.markPrice.toString(),
      mmr: this.mmr.toString(),
    };

    return JSON.stringify(snapshot);
  }

  static createFromSnapshot(positionSnapshotstring: string): Position | null {
    const parseData = positionSnapshotSchema.safeParse(JSON.parse(positionSnapshotstring));
    if (!parseData.success) return null;
    const positionSnapshot = parseData.data;

    const { userId, qty, side, initialMargin, state, id, avgPrice, mmr, markPrice } = positionSnapshot;

    const position = new Position(userId, qty, avgPrice, side, mmr, markPrice, initialMargin);
    position.id = id;
    position.state = state;
    position.setLiquidationPrice();
    position.setUnrealizedPnL();
    return position;
  }

  setInitialMargin() {
    const positionalSize = this.avgPrice * this.qty;
  }
  setUnrealizedPnL() {
    let direction = this.side === 'SHORT' ? -1n : 1n;
    this.unrealizedPnL = (this.markPrice - this.avgPrice) * this.qty * direction;
  }

  setLiquidationPrice() {
    if (this.qty === 0n || this.state === 'CLOSED') {
      throw new Error('qty is zero,we cannot measure of zero qty or state is closed ');
    }
    const direction = this.side === 'SHORT' ? 1n : -1n;
    this.liquidationPrice =
      (this.avgPrice * this.qty * this.MMR_SCALE + this.initialMargin * direction * this.MMR_SCALE) /
      (this.qty * (this.MMR_SCALE + direction * this.mmr));
  }

  setLeverage(leverage: bigint) {}

  setNewAvgPrice(price: bigint, qty: bigint) {
    this.avgPrice = (this.avgPrice * this.qty + price * qty) / (this.qty + qty);
  }
  addFill(price: bigint, qty: bigint, leverage: bigint, side: 'LONG' | 'SHORT') {
    //know wether the add fill is on the on the same side or not

    const sameSide = side === this.side;
    if (sameSide) {
      //add quantity
      //recalculate the avg price,liquidationPrice and also the margins and also change the unrealized PnL
      this.setNewAvgPrice(price, qty);
      this.qty += qty;
      const margin = (price * qty) / leverage;
      this.initialMargin += margin;
      this.setLiquidationPrice();
    } else {
      if (qty < this.qty) {
        /**
         * decrease quantity
         * avg price wont change
         * inital margin decreased
         * calculate liquidation
         */
        const marginPerQty = this.initialMargin / this.qty;
        this.qty -= qty;
        this.initialMargin = this.qty * marginPerQty;

        this.setLiquidationPrice();
      } else if (qty > this.qty) {
        //reversal case
        const netQuantity = qty - this.qty;
        this.qty = netQuantity;
        this.avgPrice = price;

        this.side = side;
        this.initialMargin = (netQuantity * price) / leverage;
        this.setLiquidationPrice();
        return;
      } else {
        //close the position
        this.state = 'CLOSED';
        this.qty = 0n;
        this.initialMargin = 0n;
      }
    }
  }
}
