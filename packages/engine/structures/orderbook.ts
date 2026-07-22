import { AskTree } from './askstree';
import { BidTree } from './bidstree';
import { Node } from './dll';
import type { EngineResponse, Id, IMarket, MatchOrder, Qty } from '@repo/types';
import { rejectOrderResponse } from '../lib/placeOrderResponses';
import { Order } from './order';
import { PriceLevelObject } from './priceLevelData';
import { z } from 'zod';

interface GiveSnapshot {
  giveSnapshot(): string;
}

type SnapshotFactory<T> = (valueSnapshotStr: string) => T | null;

const orderSnapshotSchema = z.object({
  asks: z.array(z.object({ price: z.string().transform((p) => BigInt(p)), levelSnapshotString: z.string() })),
  bids: z.array(z.object({ price: z.string().transform((p) => BigInt(p)), levelSnapshotString: z.string() })),
   askTree: z.array(z.string().transform((p) => BigInt(p))),
   bidTree: z.array(z.string().transform((p) => BigInt(p))),
   updateId: z.number(),
});

export class OrderBook {
  public asks: Map<bigint, PriceLevelObject<Order>>;
  public bids: Map<bigint, PriceLevelObject<Order>>;
  public askTree: AskTree;
  public bidTree: BidTree;
  private updateId:number = 0;

  private ordersRef: Map<string, Node<Order>>;

  constructor() {
    this.asks = new Map<bigint, PriceLevelObject<Order>>();
    this.bids = new Map<bigint, PriceLevelObject<Order>>();
    this.askTree = new AskTree();
    this.bidTree = new BidTree();
    this.ordersRef = new Map<string, Node<Order>>();
  }

  giveSnapshot() {
    const askTree = this.askTree.clone();
    const bidTree = this.bidTree.clone();
    let asks: { price: string; levelSnapshotString: string }[] = [];
    for (const [price, priceLevelData] of this.asks.entries()) {
      const entry = { price: price.toString(), levelSnapshotString: priceLevelData.giveSnapshot() };
      asks.push(entry);
    }

    let bids: { price: string; levelSnapshotString: string }[] = [];
     for (const [price, priceLevelData] of this.bids.entries()) {
       const entry = { price: price.toString(), levelSnapshotString: priceLevelData.giveSnapshot() };
       bids.push(entry);
     }
 
    return JSON.stringify({ asks, bids, askTree, bidTree, updateId: this.updateId });
   }

  static createLevelMap<T extends Qty & GiveSnapshot & Id>(
    priceLevel: { price: bigint; levelSnapshotString: string },
    priceLevelMap: Map<bigint, PriceLevelObject<T>>,
    createFromSnapshot: SnapshotFactory<T>,
    ref: Map<string, Node<T>>,
  ) {
    const { price, levelSnapshotString } = priceLevel;
    const priceLevelData = PriceLevelObject.createFromSnapShort<T>(levelSnapshotString, createFromSnapshot);

    if (priceLevelData === null) return null;
    const head = priceLevelData.list.getFirstOrder();
    let current: Node<T> | null = head;
    while (current != null) {
      const node = current.value;
      ref.set(node.id, current);
      current = current.right;
    }
    priceLevelMap.set(price, priceLevelData);
  }

  static createFromSnapshot(orderSnapshotString: string) {
    const parseData = orderSnapshotSchema.safeParse(JSON.parse(orderSnapshotString));
    if (!parseData.success) {
      return null;
    }

    const orderbookSnapshot = parseData.data;

    //create the new order book;
    //create new asks tree,bids tree , shorts tree , longs tree
    const askTree = AskTree.create(orderbookSnapshot.askTree);
    const bidTree = BidTree.create(orderbookSnapshot.bidTree);
    const ordersRef = new Map<string, Node<Order>>();
    const asks = new Map<bigint, PriceLevelObject<Order>>();
    for (const priceLevel of orderbookSnapshot.asks) {
      const { price, levelSnapshotString } = priceLevel;
      const priceLevelData = PriceLevelObject.createFromSnapShort<Order>(levelSnapshotString, Order.createFromSnapshot);

      if (priceLevelData === null) return null;
      let current: Node<Order> | null = priceLevelData.list.getFirstOrder();

      while (current != null) {
        const node = current.value;
        ordersRef.set(node.id, current);
        current = current.right;
      }
      asks.set(price, priceLevelData);
    }
    const bids = new Map<bigint, PriceLevelObject<Order>>();
    for (const priceLevel of orderbookSnapshot.bids) {
      const { price, levelSnapshotString } = priceLevel;
      const priceLevelData = PriceLevelObject.createFromSnapShort<Order>(levelSnapshotString, Order.createFromSnapshot);

      if (priceLevelData === null) return null;
      let current: Node<Order> | null = priceLevelData.list.getFirstOrder();

      while (current != null) {
        const node = current.value;
        ordersRef.set(node.id, current);
        current = current.right;
      }
      bids.set(price, priceLevelData);
    }

    const orderbook = new OrderBook();
    orderbook.asks = asks;
    orderbook.bids = bids;
    orderbook.askTree = askTree;
     orderbook.bidTree = bidTree;
     orderbook.ordersRef = ordersRef;
     orderbook.updateId = orderbookSnapshot.updateId;
 
     return orderbook;
  }
  getUpdateId(){
    return this.updateId;
  }

  deleteOrder(orderId: string) {
    const node = this.ordersRef.get(orderId);
    if (!node) return { success: false, error: 'did not find the reference' };

    const order = node.value;
    order.side === 'SHORT' ? this.removeAskOrder(order) : this.removeBuyOrder(order);

    const levelData = order.side === 'SHORT' ? this.asks.get(order.price) : this.bids.get(order.price);
    const totalQty = levelData?.totalQty ?? 0n;

    const updates = {
      uid:this.updateId++,
      bids: order.side === 'LONG' ? [[order.price.toString(), totalQty.toString()]] : [[]],
      asks: order.side === 'SHORT' ? [[order.price.toString(), totalQty.toString()]] : [[]],
    };

    return { success: true, updates, order: order };
  }

  addAskOrder(order: Order) {
    const price = order.price;
    //wether level is present or not
    const levelData = this.asks.get(price);
    if (levelData === undefined) {
      //create level and create ask level price in ask tree and add order to the list
      let newLevelData = PriceLevelObject.createFromOrder<Order>(order);
      this.askTree.addPrice(price);
      this.asks.set(price, newLevelData);
      this.ordersRef.set(order.orderId, newLevelData.list.getFirstOrder());
      return;
    } else {
      //present add order to the list and update the qty
      const orderNode = new Node<Order>(order);
      levelData.addNode(orderNode);
      this.ordersRef.set(order.orderId, orderNode);
    }
  }

  addBidOrder(order: Order) {
    const price = order.price;

    //check level
    const levelData = this.bids.get(price);
    if (levelData === undefined) {
      //level not there create the level and add bidprice to the bidtree and add the order
      const newLevelData = PriceLevelObject.createFromOrder<Order>(order);
      this.bids.set(price, newLevelData);
      this.bidTree.addPrice(price);
      this.ordersRef.set(order.orderId, newLevelData.list.getFirstOrder());
      return;
    } else {
      const node = new Node<Order>(order);
      levelData.addNode(node);
      this.ordersRef.set(order.orderId, node);
      return;
    }
  }

  removeAskOrder(order: Order) {
    //we need to remove the orderRef
    //we need to remove the level if dll have only one order also
    //we need to remove the the price from ask tree also
    const priceLevel = order.price;
    const priceLevelData = this.asks.get(priceLevel);
    if (priceLevelData === undefined) {
      return { succes: true, message: 'price level not found' };
    }

    let orderNode = this.ordersRef.get(order.orderId);
    if (orderNode === undefined) {
      return { success: true, message: 'order not found' };
    }
    const response = priceLevelData.removeNode(orderNode);
    if (!response.success) {
      //we nee to remove the price level
     const levelDelete =  this.asks.delete(priceLevel);
     const treeDelete = this.askTree.removePrice(order.price);
      
      console.log('removed Levelstatus:',levelDelete," removed TreeStatus:",treeDelete);
    }
    this.ordersRef.delete(order.orderId);
    return { success: 'true', message: 'removed order' };
  }

  removeBuyOrder(order: Order) {
    //we need to remove the orderRef
    //we need to remove the level if dll have only one order also
    //we need to remove from the bid trees also
    const priceLevel = order.price;
    const priceLevelData = this.bids.get(priceLevel);
    if (priceLevelData === undefined) {
      return { succes: true, message: 'price level not found' };
    }

    let orderNode = this.ordersRef.get(order.orderId);
    if (orderNode === undefined) {
      return { success: true, message: 'order not found' };
    }
    const response = priceLevelData.removeNode(orderNode);
    if (!response.success) {
      //we nee to remove the price level
     const levelDelete = this.bids.delete(priceLevel);
      const treeDelete = this.bidTree.removePrice(order.price)
      console.log('removed Levelstatus:',levelDelete," removed TreeStatus:",treeDelete);
    }
    this.ordersRef.delete(order.orderId);
    return { success: 'true', message: 'removed order' };
  }
  matchOrder(order: Order) {
    const { qty, price } = order;

    const matchedOrders: MatchOrder[] = [];

    const executionPrices = order.side === "LONG" ? this.askTree.getBestAsks(price).reverse() :this.bidTree.getBestBids(price).reverse();

    if(executionPrices.length === 0){
      
      order.side === 'LONG' ? this.addBidOrder(order) : this.addAskOrder(order);
      // read the actual total quantity at this price level after adding
      const levelAfterAdd = order.side === 'LONG' ? this.bids.get(price) : this.asks.get(price);
      const totalQty = levelAfterAdd?.totalQty ?? qty;
      let updates = {
        uid:this.updateId++,
        bids: order.side === 'LONG' ? [[price.toString(), totalQty.toString()]] : [[]],
        asks: order.side === 'SHORT' ? [[price.toString(), totalQty.toString()]] : [[]],
      };
      return {
        event: 'ORDER_ACCEPTED',
        payload: {
          filled: order.filled,
          updates,
        },
      };

    }

    const updates:{uid:number,asks:string[][],bids:string[][]} = {
      uid:-2,
      asks:[],
      bids:[]
    }
    //get the pricelevel for oppsite side of the limit order, Limit order of Buy fetch ask and vice versa
    console.log("execution prices-",executionPrices);
    for( const executionPrice of executionPrices){

      console.log("executing price-",executionPrice);
      
      let opSidelevelData = order.side === 'LONG' ? this.asks.get(executionPrice) : this.bids.get(executionPrice);
      if(!opSidelevelData){
        throw new Error("[critical]- data inconsitent ,price exist in trees but not in level maps")
      }
      const ordersLength = opSidelevelData.list.length;

      //match the resting limit orders in FIFO order
      let currentOrderNode: Node<Order> | null = opSidelevelData.list.getFirstOrder();
      for (let index = 0; index < ordersLength; index++) {
        if (!currentOrderNode) break;
        const matchedOrder = currentOrderNode.value;
        const nextNode: Node<Order> | null = currentOrderNode.right;

        if (matchedOrder.userId === order.userId) {
          currentOrderNode = nextNode;
          continue;
        }
  
        const requiredQty = order.qty - order.filled;
        const availablleQty = matchedOrder.qty - matchedOrder.filled;
        let filled = requiredQty <= availablleQty ? requiredQty : availablleQty;
  
        matchedOrder.filled += filled;
        opSidelevelData.totalQty -= filled;
        order.filled += filled;
      
        matchedOrders.push({
          userId: matchedOrder.userId,
          price: executionPrice,
          leverage: matchedOrder.leverage,
          orderId: matchedOrder.orderId,
          qtyTransfered: filled,
          side: matchedOrder.side,
          timestamp: Date.now().toString(),
          tax: 0n,
        });

        //after every matchedorder fullfilled resting order converts to position, remove from the book and if last level add update to th updates
  
        if (matchedOrder.filled === matchedOrder.qty) {
          //matched order is fullfilled from remove from the book
          matchedOrder.side === 'SHORT' ? this.removeAskOrder(matchedOrder) : this.removeBuyOrder(matchedOrder);
          //we need to update if level itself removed
          const priceLevel = matchedOrder.side === "SHORT" ? this.asks.get(executionPrice) : this.bids.get(executionPrice);
          if(priceLevel === undefined){
            //level is removed need to update
            
            matchedOrder.side === "SHORT" ? updates.asks.push([executionPrice.toString(),"0"]): updates.bids.push([executionPrice.toString(),"0"]);
          }
          
        }

        //incoming order consumed some qty fron the level so add update of the level
        if (order.filled === order.qty) {
          updates.uid = this.updateId++;
          matchedOrder.side === 'SHORT' ? updates.asks.push( [executionPrice.toString(), opSidelevelData.totalQty.toString()]) :updates.bids.push([executionPrice.toString(), opSidelevelData.totalQty.toString()]);

          return {
            event: 'ORDER_FILLED',
            payload: {
              filled: order.filled,
              matchedOrders,
              updates,
            },
          };
        }
        
        currentOrderNode = nextNode;
      }


    }

    //some qty of limit order not matched place it in the book
  
      //place in the order book:
      order.side === 'LONG' ? this.addBidOrder(order) : this.addAskOrder(order);
      const level = order.side === "LONG" ? this.bids.get(price) : this.asks.get(price);
      let totalQuantity = level?.totalQty;
      if(!totalQuantity) throw new Error("[critical] after adding order at price P, the price levleMap total quanitity is not updated");
      
      level!.totalQty -= order.filled;
      totalQuantity = totalQuantity - order.filled;

      order.side === "LONG" ? updates.bids.push([price.toString(),totalQuantity.toString()]) : updates.asks.push([price.toString(),totalQuantity.toString()]);

      updates.uid = this.updateId++;
  
    if (order.filled === 0n) {
      return {
        event: 'ORDER_ACCEPTED',
        payload: {
          filled: order.filled,
          updates,
        },
      };
    }

    return {
      event: 'ORDER_FILLED_PARTIALLY',
      payload: {
        filled: order.filled,
        updates,
        matchedOrders,
      },
    };
  }
  matchMarketOrder(order: Order) {
    const { qty, price, side, userId } = order;

    const executionPricesStr = order.side === "LONG" ? this.askTree.clone() : this.bidTree.clone();
    const executionPrices = executionPricesStr.map(p => BigInt(p)).reverse();

    const matchedOrders: MatchOrder[] = [];
    let bids: string[][] = [];
    let asks: string[][] = [];

    if (executionPrices.length === 0) {
      return rejectOrderResponse('no counter offers', { ...order, marketId: order.assetId });
    }

    for (const level of executionPrices) {
      let opSidelevelData = order.side === 'LONG' ? this.asks.get(level) : this.bids.get(level);
      if (opSidelevelData === undefined) {
        //no opposite price level present for the asset ,so reject he market Order
        order.side === 'LONG' ? this.addBidOrder(order) : this.addAskOrder(order);
        return rejectOrderResponse('no counter offers', { ...order, marketId: order.assetId });
      }

      //ask level avialable ---> we can match the order and execute the order --->add to position or open new position
      const ordersLength = opSidelevelData.list.length;
      let currentOrderNode: Node<Order> | null = opSidelevelData.list.getFirstOrder();

      for (let index = 0; index < ordersLength; index++) {
        if (!currentOrderNode) break;
        const matchedOrder = currentOrderNode.value;
        const nextNode: Node<Order> | null = currentOrderNode.right;

        if (matchedOrder.userId === order.userId) {
          currentOrderNode = nextNode;
          continue;
        }

        const requiredQty = order.qty - order.filled;
        const availablleQty = matchedOrder.qty - matchedOrder.filled;

        

        //executing the order
        if (requiredQty <= availablleQty) {
          matchedOrder.filled += requiredQty;
          order.filled += requiredQty;
        } else {
          matchedOrder.filled += availablleQty;
          order.filled += availablleQty;
        }

        matchedOrders.push({
          price: matchedOrder.price,
          leverage: matchedOrder.leverage,
          side: matchedOrder.side,
          userId: matchedOrder.userId,
          orderId: matchedOrder.orderId,
          qtyTransfered: matchedOrder.filled,
          timestamp: Date.now().toString(),
          tax: 0n,
        });

        if (matchedOrder.filled === matchedOrder.qty) {
          //order is filled completely so the order is removed from the pricelevel
          matchedOrder.side === 'SHORT' ? this.removeAskOrder(matchedOrder) : this.removeBuyOrder(matchedOrder);
        }
        if (order.filled === order.qty) {
          let updates = {
            uid:this.updateId++,
            bids: matchedOrder.side === 'LONG' ? [[price.toString(), opSidelevelData.totalQty.toString()]] : [[]],
            asks: matchedOrder.side === 'SHORT' ? [[price.toString(), opSidelevelData.totalQty.toString()]] : [[]],
          };
          return {
            event: 'ORDER_FILLED' as const,
            payload: {
              type: order.type,
              qty: qty,
              state: 'FILLED',
              userId,
              side,
              marketId: order.assetId,
              orderId: order.orderId,
              filled: order.qty,
              price: order.price,
              matchedOrders,
              updates,
            },
          };
        }
        
        currentOrderNode = nextNode;
      }
      if (order.side === 'SHORT') {
        bids.push([price.toString(), opSidelevelData.totalQty.toString()]);
      } else {
        asks.push([price.toString(), opSidelevelData.totalQty.toString()]);
      }
    }
    
    if (order.filled === 0n) {
      return rejectOrderResponse('no counter offers', { ...order, marketId: order.assetId });
    }

    return {
      event: 'ORDER_FILLED_PARTIALLY' as const,
      payload: {
        type: order.type,
        qty: qty,
        state: 'FILLED',
        userId,
        side,
        marketId: order.assetId,
        orderId: order.orderId,
        filled: order.qty,
        price: order.price,
        matchedOrders,
        updates: {
          uid:this.updateId++,
          asks,
          bids,
        },
      },
    };
  }
}
