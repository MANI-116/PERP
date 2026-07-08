import { Node } from './dll';
import { PriceLevelObject } from './priceLevelData';
import { Position } from './position';
import { BidTree } from './bidstree';
import { AskTree } from './askstree';
import { OrderBook } from './orderbook';
import type { OrderSide } from '@repo/types';
import { z } from 'zod';

const marketSnapshotSchema = z.object({
  symbol: z.string(),
  marketId: z.string(),
  markPrice: z.string().transform((p) => BigInt(p)),
  mmr: z.string().transform((p) => BigInt(p)),
  takerRate: z.string().transform((p) => BigInt(p)),
  makerRate: z.string().transform((p) => BigInt(p)),
  taxationScale: z.string().transform((p) => BigInt(p)),
  longsSnapshot: z.array(z.object({ price: z.string(), priceLevelSnapshot: z.string() })),
  longsTreeSnapshot: z.array(z.string()),
  shortsSnapshot: z.array(z.object({ price: z.string(), priceLevelSnapshot: z.string() })),
  shortsTreeSnapshot: z.array(z.string()),
  orderbookSnapshot: z.string(),
});
export class Market {
  public longs: Map<bigint, PriceLevelObject<Position>>;
  public shorts: Map<bigint, PriceLevelObject<Position>>;
  public positionsRef: Map<string, Node<Position>>;
  public longsTree: BidTree;
  public shortsTree: AskTree;
  public orderbook: OrderBook;

  private constructor(
    public symbol: string,
    public marketId: string,
    public markPrice: bigint,
    public mmr: bigint,
    public takerRate: bigint,
    public makerRate: bigint,
    public taxationScale: bigint,
  ) {
    this.longs = new Map<bigint, PriceLevelObject<Position>>();
    this.shorts = new Map<bigint, PriceLevelObject<Position>>();
    this.positionsRef = new Map<string, Node<Position>>();
    this.longsTree = new BidTree();
    this.shortsTree = new AskTree();
    this.orderbook = new OrderBook();
  }

  static create(
    symbol: string,
    marketId: string,
    markPrice: bigint,
    mmr: bigint,
    takerRate: bigint,
    makerRate: bigint,
    taxationScale: bigint,
  ) {
    return new Market(symbol, marketId, markPrice, mmr, takerRate, makerRate, taxationScale);
  }

  giveSnapshot() {
    //symbol,marketId,markPrice,mmr,takerRate,makerRate,taxationScale,longs,shorts,positionsRef,longsTree,shortsTree,orderBook
    //orderbook , longstree, shortsTree have there ownsnapshot and recovery and for position also
    //positionRef need to be created
    const longsSnapshot = Array.from(this.longs.entries()).map((e) => {
      return { price: e[0].toString(), priceLevelSnapshot: e[1].giveSnapshot() };
    });
    const shortsSnapshot = Array.from(this.shorts.entries()).map((e) => {
      return { price: e[0].toString(), priceLevelSnapshot: e[1].giveSnapshot() };
    });
    const longsTreeSnapshot = this.longsTree.clone();
    const shortsTreeSnapshot = this.shortsTree.clone();
    const orderbookSnapshot = this.orderbook.giveSnapshot();

    return JSON.stringify({
      symbol: this.symbol,
      marketId: this.marketId,
      markPrice: this.markPrice.toString(),
      mmr: this.mmr.toString(),
      takerRate: this.takerRate.toString(),
      makerRate: this.makerRate.toString(),
      taxationScale: this.taxationScale.toString(),
      longsSnapshot,
      longsTreeSnapshot,
      shortsSnapshot,
      shortsTreeSnapshot,
      orderbookSnapshot,
    });
  }

  static createFromSnapshot(snapshotString: string) {
    const parseData = marketSnapshotSchema.safeParse(JSON.parse(snapshotString));
    if (!parseData.success) {
      return null;
    }
    const {
      symbol,
      marketId,
      markPrice,
      mmr,
      takerRate,
      makerRate,
      taxationScale,
      longsSnapshot,
      longsTreeSnapshot,
      shortsSnapshot,
      shortsTreeSnapshot,
      orderbookSnapshot,
    } = parseData.data;
    const longsLevelMap = new Map<bigint, PriceLevelObject<Position>>();
    const shortsLevelMap = new Map<bigint, PriceLevelObject<Position>>();
    const positionRef = new Map<string, Node<Position>>();

    for (const level of longsSnapshot) {
      const levelData = PriceLevelObject.createFromSnapShort<Position>(
        level.priceLevelSnapshot,
        Position.createFromSnapshot,
      );
      if (levelData === null) return null;
      const list = levelData.list;
      let current: Node<Position> | null = list.getFirstOrder();
      while (current != null) {
        positionRef.set(current.value.id, current);
        current = current.right;
      }
      longsLevelMap.set(BigInt(level.price), levelData);
    }
    for (const level of shortsSnapshot) {
      const levelData = PriceLevelObject.createFromSnapShort<Position>(
        level.priceLevelSnapshot,
        Position.createFromSnapshot,
      );
      if (levelData === null) return null;
      const list = levelData.list;
      let current: Node<Position> | null = list.getFirstOrder();
      while (current != null) {
        positionRef.set(current.value.id, current);
        current = current.right;
      }
      shortsLevelMap.set(BigInt(level.price), levelData);
    }

    const orderbook = OrderBook.createFromSnapshot(orderbookSnapshot);
    if (!orderbook) return null;

    const newMarket = Market.create(symbol, marketId, markPrice, mmr, takerRate, makerRate, taxationScale);
    newMarket.longs = longsLevelMap;
    newMarket.shorts = shortsLevelMap;
    newMarket.positionsRef = positionRef;
    newMarket.orderbook = orderbook;
    newMarket.longsTree = BidTree.create(longsTreeSnapshot.map((p) => BigInt(p)));
    newMarket.shortsTree = AskTree.create(shortsTreeSnapshot.map((p) => BigInt(p)));

    return newMarket;
  }

  calculatetax(notionalAmount: bigint, type: 'taker' | 'maker') {
    let taxRate = type === 'taker' ? this.takerRate : this.makerRate;
    const tax = (notionalAmount * taxRate) / this.taxationScale;
    return tax;
  }

  calculateEstimatedPrice(qty: bigint, side: OrderSide) {
    let filled = 0n;

    let totalLevels = side === 'SHORT' ? this.orderbook.bidTree.getLength() : this.orderbook.askTree.getLength();
    const removedPrices: bigint[] = [];
    let notionalSize = 0n;
    for (let i = 0; i < totalLevels; i++) {
      //get the pricelevel from opposite side
      const priceLevel = side === 'SHORT' ? this.orderbook.bidTree.getTop() : this.orderbook.askTree.getMinAsk();
      if (priceLevel === undefined) {
        console.log('bug: trees length and the actual number of prices are not mapped');
        continue;
      }
      let opSidelevelData = side === 'LONG' ? this.orderbook.asks.get(priceLevel) : this.orderbook.bids.get(priceLevel);
      if (opSidelevelData === undefined) {
        //TODO
        return;
      }

      const requiredQty = qty - filled;
      const availableQty = opSidelevelData.totalQty;
      if (availableQty >= requiredQty) {
        filled += requiredQty;
        notionalSize += requiredQty * priceLevel;
        break;
      } else {
        filled += availableQty;
        notionalSize += availableQty * priceLevel;
        removedPrices.push(priceLevel);
        side === 'SHORT'
          ? this.orderbook.bidTree.removePrice(priceLevel)
          : this.orderbook.askTree.removePrice(priceLevel);
      }
    }
    removedPrices.forEach((p) =>
      side === 'SHORT' ? this.orderbook.bidTree.addPrice(p) : this.orderbook.askTree.addPrice(p),
    );
    if (filled === 0n) {
      return 0n;
    }
    let estimatedPrice = notionalSize / filled;
    if (estimatedPrice === undefined) return 0n;
    return estimatedPrice;
  }

  getMargin(positionId: string) {
    const positionNode = this.positionsRef.get(positionId);
    if (!positionNode) return { error: ' postion not found', success: false };

    const position = positionNode.value;
    return { success: true, margin: position.initialMargin };
  }

  getData<K extends keyof Position>(positionId: string, data: { keys: K[] }) {
    const positionNode = this.positionsRef.get(positionId);
    if (!positionNode) return { error: ' postion not found', success: false };

    const position = positionNode.value;
    const responseData = {} as Pick<Position, K>;
    data.keys.forEach((key) => {
      if (key in position) {
        responseData[key] = position[key];
      }
    });
    return { success: true, data: responseData };
  }

  getSide(positionId: string) {
    const positionNode = this.positionsRef.get(positionId);
    if (!positionNode) return { error: ' postion not found', success: false };

    const position = positionNode.value;
    return { success: true, side: position.side };
  }

  getQty(positionId: string) {
    const positionNode = this.positionsRef.get(positionId);
    if (!positionNode) return { error: ' postion not found', success: false };

    const position = positionNode.value;
    return { success: true, qty: position.qty };
  }

  PartialFillPosition(positionId: string, price: bigint, qty: bigint) {
    const positionNode = this.positionsRef.get(positionId);
    if (!positionNode) return { error: ' postion not found', success: false };

    const position = positionNode.value;
    if (position.qty < qty) {
      return { success: false, message: 'cannot fill the postion , had less qty' };
    }
    const direction = position.side === 'SHORT' ? -1n : 1n;
    const realizedPnL = (price - position.avgPrice) * qty * direction;
    const releasedMargin = (position.initialMargin * qty) / position.qty;
    const settlementAmount = releasedMargin + realizedPnL;

    if (settlementAmount < 0) {
      return { success: false, error: 'liquidate_position', settlementAmountWithoutTax: settlementAmount };
    }
    position.initialMargin -= releasedMargin;
    position.qty -= qty;
    if (position.qty === 0n) {
      position.state = 'CLOSED';
    }

    return { success: true, message: 'updated positons', settlementAmount };
  }

  updatePositions(positionId: string, side: OrderSide, userId: string, price: bigint, leverage: bigint, qty: bigint) {
    /**
     * we have the existing position, but the order either to settle or take more
     *
     */
    // const response = { isNewPosition:false, positionId:"",initialMargin:0n}
    const positionNode = this.positionsRef.get(positionId);
    if (!positionNode) return { error: ' postion not found', success: false };
    let position = positionNode.value;

    const presentSide = side;
    if (position.side === presentSide) {
      const oldLp = position.liquidationPrice;
      position.addFill(price, qty, leverage, position.side);
      const newLp = position.liquidationPrice;
      if (oldLp != newLp) {
        //remove the position from old lp
        side === 'SHORT' ? this.removeShort(position, oldLp) : this.removeLong(position, oldLp);
        //add positon to new lp
        side === 'SHORT' ? this.addShort(position) : this.addLong(position);
      }
    } else {
      //settle the contract for quantity qty
      //need to settle the unrealizedPnL
      if (qty > position.qty) {
        const oldSide = position.side;
        const oldLp = position.liquidationPrice;
        position.addFill(price, qty, leverage, side);

        const newQty = position.qty;
        //remove the position from lp map
        oldSide === 'SHORT' ? this.removeShort(position, oldLp) : this.removeLong(position, oldLp);

        // let newPos = this.createPosition(userId,newQty,price,side,leverage) ;

        // response.isNewPosition= true;
        // response.positionId = newPos.positionId;
        // response.initialMargin  = newPos.initialMargin
      } else {
        //settle the position
        const oldLp = position.liquidationPrice;
        position.addFill(price, qty, leverage, side);

        side === 'SHORT' ? this.removeShort(position, oldLp) : this.removeLong(position, oldLp);
        if (position.state != 'CLOSED') {
          side === 'SHORT' ? this.addShort(position) : this.addLong(position);
        }
      }
    }
  }

  addLong(position: Position) {
    const liquidationPrice = position.liquidationPrice;

    //if we have the pricelevel
    let levelData = this.longs.get(liquidationPrice);
    let positionRef: Node<Position>;
    if (levelData === undefined) {
      //-->  create the the pricelevel and add postion and add level to the longsTree
      levelData = PriceLevelObject.createFromOrder<Position>(position);
      this.longs.set(liquidationPrice, levelData);
      positionRef = levelData.list.getFirstOrder();
      this.longsTree.addPrice(liquidationPrice);
    } else {
      //-->then added it to the list add postion reference to positionrefmap
      positionRef = new Node<Position>(position);
      levelData.list.addNode(positionRef);
    }
    //add the reference to the map
    this.positionsRef.set(positionRef.value.id, positionRef);
    return { message: 'added successfully' };
  }

  addShort(position: Position) {
    const liquidationPrice = position.liquidationPrice;

    //if we have the pricelevel
    let levelData = this.shorts.get(liquidationPrice);
    let positionRef: Node<Position>;
    if (levelData === undefined) {
      //-->  create the the pricelevel and add postion and add level to the longsTree
      levelData = PriceLevelObject.createFromOrder<Position>(position);
      this.shorts.set(liquidationPrice, levelData);
      positionRef = levelData.list.getFirstOrder();
      this.shortsTree.addPrice(liquidationPrice);
    } else {
      //-->then added it to the list add postion reference to positionrefmap
      positionRef = new Node<Position>(position);
      levelData.list.addNode(positionRef);
    }
    //add the reference to the map
    this.positionsRef.set(positionRef.value.id, positionRef);
    return { message: 'added successfully' };
  }

  removeShort(position: Position, lp?: bigint) {
    //get the level
    // ******** lp is for the postions which transitioned from the short to long
    //single order remove level,remove ref and remove treePrice check wether positon is long or short
    const level = lp ? this.shorts.get(lp) : this.shorts.get(position.liquidationPrice);
    if (level === undefined) {
      return { success: false, message: 'position doesnot exist' };
    }
    //get the reference of the position
    const posRef = this.positionsRef.get(position.id);
    if (posRef === undefined) {
      return { success: false, message: 'no position found' };
    }
    const response = level.list.removeNode(posRef);
    if (!response.success) {
      //single order ,need to remove the whole level and levelprice in the shorts tree
      console.log('removing level and the pprice in tree');
      this.shorts.delete(position.liquidationPrice);
      this.shortsTree.removePrice(position.liquidationPrice);
      this.positionsRef.delete(position.id);
      return { success: true, message: 'position removed succesfully' };
    }
    this.positionsRef.delete(position.id);
    return { success: true, message: 'removed the postion' };
  }

  removeLong(position: Position, lp?: bigint) {
    //get the level
    //single order remove level,remove ref and remove treePrice
    const level = lp ? this.longs.get(lp) : this.longs.get(position.liquidationPrice);
    if (level === undefined) {
      return { success: false, message: 'position doesnot exist' };
    }
    //get the reference of the position
    const posRef = this.positionsRef.get(position.id);
    if (posRef === undefined) {
      return { success: false, message: 'no position found' };
    }
    const response = level.list.removeNode(posRef);
    if (!response.success) {
      //single order ,need to remove the whole level and levelprice in the longs tree
      console.log('removing level and the pprice in tree');
      this.longs.delete(position.liquidationPrice);
      this.longsTree.removePrice(position.liquidationPrice);
      this.positionsRef.delete(position.id);
      return { success: true, message: 'position removed succesfully' };
    }
    this.positionsRef.delete(position.id);
    return { success: true, message: 'removed the postion' };
  }
  addShortLiquidationPrice(price: bigint) {
    return this.shortsTree.addPrice(price);
  }
  addLongLiquidationPrice(price: bigint) {
    return this.longsTree.addPrice(price);
  }

  cutInitialMargin(positionId: string, amount: bigint) {
    const position = this.positionsRef.get(positionId);
    if (!position) return { success: false };
    const response = position.value.reduceMargin(amount);
    return response;
  }

  createPosition(userId: string, qty: bigint, price: bigint, side: OrderSide, initialMargin: bigint) {
    const position = new Position(userId, qty, price, side, this.mmr, this.markPrice, initialMargin);

    //add position
    side === 'SHORT' ? this.addShort(position) : this.addLong(position);

    return { positionId: position.id, initialMargin: position.initialMargin };
  }
}
