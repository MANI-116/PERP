import type { Order } from './order';
import { z } from 'zod';

const userSnapshotSchema = z.object({
  userId: z.string(),
  available: z.string().transform((p) => BigInt(p)),
  locked: z.string().transform((p) => BigInt(p)),
  positions: z.array(z.array(z.string().min(1)).length(2)),
  ordersLockAmount:z.array(z.array(z.string().min(1)).length(2))
});
interface PositionIdentifier {
  id: string;
  marketId: string;
}

//gonna add orders and lock amount

//when lock amount is called , add lock amount to the order id
//debit lock amount ,now we need to have orderid along with amount, deduce the amount in orderId and lock amount
//clear lockamount for an order add the amount to the user available and delete the orderId
//add order-lock hash table to the snapshot and recover it

export class User {
  public  collateral: { available: bigint; locked: bigint };
  public positions: Map<string, string>;
  private ordersLockAmount:Map<string,bigint>

  constructor(public userId: string) {
    this.positions = new Map<string, string>();
    this.collateral = { available: 0n, locked: 0n };
    this.ordersLockAmount = new Map<string,bigint>();

  }

  giveSnapshot() {
    return JSON.stringify({
      userId: this.userId,
      available: this.collateral.available.toString(),
      locked: this.collateral.locked.toString(),
      positions: Array.from(this.positions.entries()),
      ordersLockAmount:Array.from(this.ordersLockAmount.entries().map(entry=>[entry[0],entry[1].toString()]))
    });
  }

  static createFromSnapshot(userSnapshotString: string) {
    const parseData = userSnapshotSchema.safeParse(JSON.parse(userSnapshotString));
    if (!parseData.success) {
      return null;
    }
    const userSnapshot = parseData.data;
    const user = new User(userSnapshot.userId);
    //add the positions
    const map = new Map<string, string>();
    userSnapshot.positions.forEach((pos) => {
      if (pos.length !== 2) return null;
      map.set(pos[0]!, pos[1]!);
    });

    user.positions = map;
    user.collateral.available = userSnapshot.available;
    user.collateral.locked = userSnapshot.locked;
    const orderLockMap = new Map<string,bigint>();
     userSnapshot.ordersLockAmount.map(entry=>[entry[0],BigInt(entry[1] as string)]).forEach((entry)=>{
      orderLockMap.set(entry[0] as string,entry[1] as bigint);
    })

    user.ordersLockAmount = orderLockMap;

    return user;
  }

  //used to lock the margin before placing the order 
  lockAmount(amount:bigint,orderId:string):{success:true,message:string}|{success:false,error:string}{
     if (this.collateral.available > amount) {
      this.collateral.available -= amount;
      this.collateral.locked += amount;
      this.ordersLockAmount.set(orderId,amount);

      console.log('amount locked:', amount);
      return { success: true, message: `amount locked-${amount/100_000_000n}: remaining amount-${this.collateral.available/100_000_000n}` };
    }
    return {
      success: false,
      error: `not have enough amount: available ${this.collateral.available/100_000_000n}: needed ${amount/100_000_000n}`,
    };

  }

  //used to release the remaining locked amount on order closed or filled
  releaseLockAmount(orderId:string){
    
    const orderLockedAmount = this.ordersLockAmount.get(orderId);
    if(orderLockedAmount === undefined) return { success:false, error:"order not found"};

    if (this.collateral.locked >= orderLockedAmount) {
      this.collateral.locked -= orderLockedAmount;
      this.collateral.available += orderLockedAmount;
      this.ordersLockAmount.delete(orderId);
      return {success:true, message:`${orderLockedAmount} is added to available balance and orderId is removed`};
    }
    return {success:false,error:`[critical] locking amount is skewed, orderLOckedAMount:${orderLockedAmount/100_000_000n} but lock amount(${this.collateral.locked/100_000_000n}) id less than orderlockedAMount`};
  }

  //used when we need to transfer the amount lock amount to the positions margin
  debitLockAmount(amount:bigint,orderId:string){
    const orderLockedAmount = this.ordersLockAmount.get(orderId);

    if(orderLockedAmount === undefined) return { success:false,error:"[critical] order not found"}
     if (this.collateral.locked >= amount && orderLockedAmount >= amount) {
      this.collateral.locked -= amount;
      this.ordersLockAmount.set(orderId,orderLockedAmount - amount);
      return { success: true, message: 'amount deducted' };
    }
    return { success: false, error: 'insufficient locked balance' };


  }

  unlockAmount(orderId:string,amount:bigint){

     const orderLockedAmount = this.ordersLockAmount.get(orderId);
    if(orderLockedAmount === undefined) return { success:false, error:"order not found"};

    if (this.collateral.locked >= amount && orderLockedAmount >= amount) {
      this.collateral.locked -= amount;
      this.collateral.available += amount;
      this.ordersLockAmount.set(orderId,orderLockedAmount- amount) ;
      return {success:true, message:`${amount/100_000_000n} is added to available balance and orderId is removed`};
    }
    return {success:false,error:`[critical] locking amount is skewed, orderLOckedAMount:${orderLockedAmount/100_000_000n} but lock amount(${this.collateral.locked/100_000_000n}) id less than orderlockedAMount`};

  }
}
