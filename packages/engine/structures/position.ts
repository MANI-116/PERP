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
  reservedQuantity:z.string().transform((p) => BigInt(p)),
  reservedByOrderId:z.array(z.array(z.string().min(1)).length(2))

});
type PositionSnapshot = z.infer<typeof positionSnapshotSchema>;

export class Position implements GiveSnapshot, Id {
  public id: string;
  public state: PositionState = 'OPEN';
  public unrealizedPnL: bigint;
  public avgPrice: bigint;
  public liquidationPrice: bigint;
  private MMR_SCALE = 1000n;
  public reservedQuantity:bigint = 0n;
  private reservedByOrderId = new Map<string,bigint>();
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
      return { success: false, error: `amount need to dedcut :${amount}, available margin:${this.initialMargin}`, };
    }
    this.initialMargin -= amount;
    return { success: true, message:`${amount} is cut from the position margin and remainig margin is ${this.initialMargin}`};
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
      reservedQuantity:this.reservedQuantity.toString(),
      reservedByOrderId:this.reservedByOrderId.entries().map((entry)=>[entry[0],entry[1].toString])
    };

    return JSON.stringify(snapshot);
  }

  static createFromSnapshot(positionSnapshotstring: string): Position | null {
    const parseData = positionSnapshotSchema.safeParse(JSON.parse(positionSnapshotstring));
    if (!parseData.success) return null;
    const positionSnapshot = parseData.data;

    const { userId, qty, side, initialMargin, state, id, avgPrice, mmr, markPrice,reservedQuantity,reservedByOrderId } = positionSnapshot;

    const position = new Position(userId, qty, avgPrice, side, mmr, markPrice, initialMargin);
    const reservedByOrdeIdtemp= new Map<string,bigint>();
    reservedByOrderId.forEach((e)=>{
       const qty = BigInt(e[1] as string);
       reservedByOrdeIdtemp.set(e[0] as string,qty);
    })

    
    position.id = id;
    position.state = state;
    position.reservedQuantity=reservedQuantity;
    position.setLiquidationPrice();
    position.setUnrealizedPnL();
    position.reservedByOrderId = reservedByOrdeIdtemp;
    return position;
  }

 
/**
 * 
 * @param orderId 
 * @param qty 
 * checks unreserved qty
 * if unreserved qty is smaller than required reject
 * else reserved the wty against the orderId
 */
  reserveClosedQty(orderId:string,qty:bigint){

    if(qty <= 0 ) return { success:false, error:"cannot reserve quantities less than or equal 0"}
    const unreservedQty = this.qty - this.reservedQuantity;

    if(this.reservedQuantity <= this.qty && unreservedQty >= qty){
      //reserve the qty
      this.reservedByOrderId.set(orderId,qty);
      this.reservedQuantity += qty;
      return { success:true,message:"qty is reserved"};
    }else{
      return {success:false,error:"not enough qty to reserve"}
    }
    
  }

  /**
   * 
   * @param orderId 
   * @param qty 
   * 
   * when my positions filled with opposite order decrease the qty of the orderId
   */
  consumeReservedCloseQty(orderId:string,qty:bigint){
    
    if(qty <= 0 ) return { success:false, error:"cannot reserve quantities less than or equal 0"}
    //get the qty reserved against the order
    const reservedClosedQty = this.reservedByOrderId.get(orderId);

    if(reservedClosedQty === undefined) throw new Error("unreserved order is trying to consume the resrved qty");

    if(qty > reservedClosedQty) throw new Error("order is tring to consume more than it reserved");

    if(this.reservedQuantity < qty) throw new Error("[critical] leak in reserved qty allocation, consume qty against order is greater than the cum reservedQty");

    //decrease the qty against the order
    this.reservedByOrderId.set(orderId,reservedClosedQty-qty);
    //decrease the cum reservedqty
    this.reservedQuantity -= qty;

    if(reservedClosedQty - qty === 0n){
      this.releaseReservedCloseQty(orderId);
      return { success:true, message: "consumed fully and removed orederId"}

    }

    return { success: true, message: " consume the orderId"}

  }

  releaseReservedCloseQty(orderId:string){

    const reservedClosedQty = this.reservedByOrderId.get(orderId);
     if(reservedClosedQty === undefined) throw new Error("unreserved order is trying to consume the resrved qty");

     //safety check : reservedqty <= cum reserved qty 
    if(reservedClosedQty > this.reservedQuantity) throw new Error("order is tring to consume more than it reserved");

     //decrease the qty in the cum reserve
     this.reservedQuantity -= reservedClosedQty;

     //delete the orderid

     this.reservedByOrderId.delete(orderId);
     return { success:true, message:"decremented the reserveqty and deleted the orderId"};

    
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
  addFill(price: bigint, qty: bigint, leverage: bigint, side: 'LONG' | 'SHORT',orderId:string,reservedClosedQty:bigint) {
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
         * decrease the reserved qty and the
         */
        const marginPerQty = this.initialMargin / this.qty;
        this.qty -= qty;
        this.initialMargin = this.qty * marginPerQty;
        this.consumeReservedCloseQty(orderId,qty);

        this.setLiquidationPrice();
      } else if (qty > this.qty) {
        //reversal case
        const netQuantity = qty - this.qty;
        this.qty = netQuantity;
        this.avgPrice = price;
        this.consumeReservedCloseQty(orderId,reservedClosedQty);

        this.side = side;
        this.initialMargin = (netQuantity * price) / leverage;
        this.setLiquidationPrice();
        return;
      } else {
        //close the position
        this.state = 'CLOSED';
        this.qty = 0n;
        this.initialMargin = 0n;
        this.releaseReservedCloseQty(orderId);
      }
    }
  }
}
