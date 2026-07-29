import { z } from 'zod';
import { User } from './user';
import { MarketManager } from './marketManager';
import type { TransmitPosition } from '@repo/types';

const userMangerSnapshotSchema = z.array(z.string());

export class UserManager {
  private users: Map<string, User>;
  private static userManager: UserManager | null;
  static reset() {
    UserManager.userManager = null;
  }
  private constructor() {
    this.users = new Map<string, User>();
  }
  static create() {
    if (UserManager.userManager) {
      return UserManager.userManager;
    } else {
      const manager = new UserManager();
      UserManager.userManager = manager;
      return UserManager.userManager;
    }
  }
  addUser(user: User) {
    const foundUser = this.users.get(user.userId);
    if (foundUser) {
      return { success: false, error: 'user found' };
    }

    this.users.set(user.userId, user);
    console.log('userCreated for id-', user.userId);

    return { success: true, message: 'userCreated' };
  }
  removerUser(userId: string) {
    const foundUser = this.users.get(userId);
    if (!foundUser) {
      return { success: false, error: 'user not found' };
    }

    this.users.delete(userId);

    return { success: true, message: 'user deleted' };
  }
  rampUser(userId: string, credit: bigint) {
    const user = this.users.get(userId);
    if (user === undefined) {
      return { success: false, message: 'user not found' };
    }

    user.collateral.available += credit;

    return {
      success: true,
      message: 'user credited successfully',
      totalAvailable: user.collateral.available.toString(),
    };
  }
  ///TODO////
  getPositions(userId: string) {
    return this._getPositionsByState(userId);
  }

  getClosedPositions(userId: string) {
    return this._getPositionsByState(userId, 'CLOSED');
  }

  private _getPositionsByState(userId: string) {
    const user = this.users.get(userId);
    if (user === undefined) {
      return { success: false, message: 'user not found' };
    }

    const marketManager = MarketManager.create();
    const positions: TransmitPosition[] = [];
    user.positions.forEach((positionId, marketId) => {
      const market = marketManager.getMarket(marketId);
      if (!market) return;
      const data = market.getData(positionId, {
        keys: [
          'id',
          'userId',
          'qty',
          'side',
          'avgPrice',
          'liquidationPrice',
          'state',
          'initialMargin',
          'markPrice',
          'unrealizedPnL',
          'mmr',
        ],
      });
      if (!data.success || !data.data) return;
      const p = data.data;
      positions.push({
        id: p.id,
        userId: p.userId,
        side: p.side,
        state: p.state,
        qty: p.qty.toString(),
        avgPrice: p.avgPrice.toString(),
        liquidationPrice: p.liquidationPrice.toString(),
        initialMargin: p.initialMargin.toString(),
        markPrice: p.markPrice.toString(),
        unrealizedPnL: p.unrealizedPnL.toString(),
        mmr: p.mmr.toString(),
      });
    });

    return { success: true, data: { positions } };
  }

  ///TODO////
  getUserEquity(userId: string) {
    const user = this.users.get(userId);
    if (user === undefined) {
      return { success: false, message: 'user not found' };
    }
    let unrealizedPnL = 0n;

    const marketManager = MarketManager.create();
    user.positions.forEach((positionId, marketId) => {
      const market = marketManager.getMarket(marketId);
      if (!market) return;
      const data = market.getData(positionId, { keys: ['unrealizedPnL'] });
      if (data.success && data.data) {
        unrealizedPnL += data.data.unrealizedPnL;
      }
    });
  console.log(`${userId} equity breakdown:locked:${user.collateral.locked}, available:${user.collateral.available},positionsUnrealizedPnL:${unrealizedPnL}`)

    const equity = (user.collateral.locked + user.collateral.available + unrealizedPnL).toString();
    return { success: true, data: { equity ,available:user.collateral.available.toString(),locked:user.collateral.locked.toString()} };
  }

  foundUser(userId: string) {
    return this.users.get(userId) != undefined;
  }

  lockAmount(userId: string, amount: bigint,orderId:string) {
    const user = this.users.get(userId);
    if (!user) throw new Error('[critical] did not find user');

    return user.lockAmount(amount,orderId)
    
  }

  unlockAmount(userId:string,orderId:string,amount:bigint){
     const user = this.users.get(userId);
    if (!user) return {success:false,error:"user not found"};
   
    return user.unlockAmount(orderId,amount)

  }
  releaseLockAmount(userId: string,orderId:string) {
    const user = this.users.get(userId);
    if (!user) return {success:false,error:"user not found"};
   
    return user.releaseLockAmount(orderId)
  }

  debitLockAmount(userId: string,orderId:string, amount: bigint) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'user not found', code: 404 };
    
    return user.debitLockAmount(amount,orderId)
  }

  getPosition(
    userId: string,
    marketId: string
  ): { success: true; positionId: string } | { success: false; error: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'user not found' };
    const position = user.positions.get(marketId);
    if (!position) return { success: false, error: 'position not found' };
    return { success: true, positionId: position };
  }
  addPosition(userId: string, marketId: string, positionId: string) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'user not found' };
    const position = user.positions.set(marketId, positionId);
  }
  removePosition(userId: string, marketId: string) {
    const user = this.users.get(userId);
    if(!user){
      throw new Error("[critical] user not found")
    }
    if (user) user.positions.delete(marketId);
  }
  giveSnapshot() {
    const usersSnapshot = [];
    for (const user of this.users.values()) {
      usersSnapshot.push(user.giveSnapshot());
    }
    return JSON.stringify(usersSnapshot);
  }
  static createFromSnapshot(usersSnapshotString: string) {
    const parseData = userMangerSnapshotSchema.safeParse(JSON.parse(usersSnapshotString) as string[]);
    if (!parseData.success) return null;

    const usersSnapshot = parseData.data;
    const userManager = UserManager.create();
    usersSnapshot.forEach((ss) => {
      const user = User.createFromSnapshot(ss);
      if (!user) return null;
      userManager.addUser(user);
    });
    return userManager;
  }
}
