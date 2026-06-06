import  { AskTree } from "./askstree";
import  { BidTree } from "./bidstree";
import  { Node } from "./dll";
import type { Id, IMarket, MatchOrder, Qty } from "@repo/types";
import { rejectOrderResponse } from "../lib/placeOrderResponses";
import  { Order } from "./order";
import  { PriceLevelObject } from "./priceLevelData";
import { z } from "zod";

interface GiveSnapshot{
    giveSnapshot():string
}

type SnapshotFactory<T> = (valueSnapshotStr: string) => T | null;


const orderSnapshotSchema = z.object({
    asks:z.array(z.object({price:z.string().transform((p)=>BigInt(p)),
        levelSnapshotString:z.string()
    })),
    bids:z.array(z.object({price:z.string().transform((p)=>BigInt(p)),
        levelSnapshotString:z.string()
    })),
    askTree:z.array(z.string().transform((p)=>BigInt(p))),
    bidTree:z.array(z.string().transform((p)=>BigInt(p))),
    })

export class OrderBook{
    public asks:Map<bigint,PriceLevelObject<Order>>;
    public bids:Map<bigint,PriceLevelObject<Order>>;
    public askTree:AskTree;
    public bidTree:BidTree;
  
    private ordersRef:Map<string,Node<Order>>
   
    constructor(){
        this.asks = new Map<bigint,PriceLevelObject<Order>>();
        this.bids = new Map<bigint,PriceLevelObject<Order>>();
        this.askTree  = new AskTree();
        this.bidTree = new BidTree();   
        this.ordersRef = new Map<string,Node<Order>>();
      
    }
    

    giveSnapshot(){
    
        const askTree= this.askTree.clone();
        const bidTree = this.bidTree.clone();
        let asks:{price:string,levelSnapshotString:string}[]=[];
        for(const [price,priceLevelData] of this.asks.entries() ){
            const entry = {price:price.toString(),levelSnapshotString:priceLevelData.giveSnapshot()};
            asks.push(entry);
        }

         let bids:{price:string,levelSnapshotString:string}[]=[];
        for(const [price,priceLevelData] of this.bids.entries() ){
            const entry = {price:price.toString(),levelSnapshotString:priceLevelData.giveSnapshot()};
            bids.push(entry);
        }

        return {orderSnapshotString:JSON.stringify({asks,bids,askTree,bidTree})};

    }

    static createLevelMap<T extends Qty & GiveSnapshot & Id>(
        priceLevel: {price: bigint;levelSnapshotString: string;},
        priceLevelMap:Map<bigint,PriceLevelObject<T>>,
        createFromSnapshot: SnapshotFactory<T>,
        ref:Map<string,Node<T>>
     ){
        const { price , levelSnapshotString} = priceLevel;
        const priceLevelData =  PriceLevelObject.createFromSnapShort<T>(levelSnapshotString,createFromSnapshot);
    
        if(priceLevelData === null) return null;    
        const head = priceLevelData.list.getFirstOrder();
            let current:Node<T>|null = head;
            while(current != null){
                const node = current.value;
                ref.set(node.id,current);
                current = current.right;
            }
            priceLevelMap.set(price,priceLevelData);

    }

    static createFromSnapshot(orderSnapshotString:string){
        const parseData = orderSnapshotSchema.safeParse(JSON.parse(orderSnapshotString));
        if(!parseData.success){
            return null;
        }

        const orderbookSnapshot = parseData.data;

        //create the new order book;
        //create new asks tree,bids tree , shorts tree , longs tree
        const askTree = AskTree.create(orderbookSnapshot.askTree);
        const bidTree = BidTree.create(orderbookSnapshot.bidTree);
        const ordersRef = new Map<string,Node<Order>>();
        const asks = new Map<bigint,PriceLevelObject<Order>>()
         orderbookSnapshot.asks.forEach((ask)=> this.createLevelMap<Order>(ask,asks,Order.createFromSnapshot,ordersRef))
        const bids = new Map<bigint,PriceLevelObject<Order>>()
         orderbookSnapshot.bids.forEach((bid)=>OrderBook.createLevelMap<Order>(bid,bids,Order.createFromSnapshot,ordersRef))

         const orderbook = new OrderBook();
         orderbook.asks = asks;
         orderbook.bids = bids;
         orderbook.askTree = askTree;
         orderbook.bidTree = bidTree;
         orderbook.ordersRef = ordersRef;

    return orderbook;
    }

    deleteOrder(orderId:string){
        const node =  this.ordersRef.get(orderId);
        if(!node) return { success:false,error:"did not find the reference"};
        const order = node.value;
        const side = order.side;
        const priceLevel = order.price;
        const levelData = side === "SHORT" ? this.asks.get(priceLevel)!:this.bids.get(priceLevel)!;
        levelData.removeNode(node);
         let updates={
            bids:order.side === "LONG"?[[order.price.toString(),levelData.totalQty.toString()]]:[[]],
            asks:order.side === "SHORT"?[[order.price.toString(),levelData.totalQty.toString()]]:[[]]

        }
        return {success:true, updates}
        
    }
  
    addAskOrder(order:Order){
        const price = order.price
        //wether level is present or not 
        const levelData = this.asks.get(price);
        if(levelData === undefined) {
            //create level and create ask level price in ask tree and add order to the list
            let newLevelData =  PriceLevelObject.createFromOrder<Order>(order);
            this.askTree.addPrice(price);
            this.asks.set(price,newLevelData);
            this.ordersRef.set(order.orderId,newLevelData.list.getFirstOrder())
            return;

        }else{
            //present add order to the list and update the qty
            const orderNode = new Node<Order>(order);
            levelData.addNode(orderNode);
            this.ordersRef.set(order.orderId,orderNode);

        }


    }

    addBidOrder(order:Order){
        const price = order.price;

        //check level
        const levelData = this.bids.get(price);
        if(levelData === undefined){
            //level not there create the level and add bidprice to the bidtree and add the order
            const newLevelData = PriceLevelObject.createFromOrder<Order>(order);
            this.bids.set(price,newLevelData);
            this.bidTree.addPrice(price);
            this.ordersRef.set(order.orderId,newLevelData.list.getFirstOrder());
            return;
        }else{

        const node = new Node<Order>(order);
        levelData?.addNode(node);
        this.ordersRef.set(order.orderId,node);
        return;        
    }
    }

    
    removeAskOrder(order:Order){
        //we need to remove the orderRef
        //we need to remove the level if dll have only one order also
        const priceLevel = order.price;
        const priceLevelData = this.asks.get(priceLevel);
        if(priceLevelData === undefined){
            return { succes:true,message:"price level not found"};

        }
        const levelList = priceLevelData.list;
        let orderNode = this.ordersRef.get(order.orderId);
        if(orderNode === undefined){ return {success:true,message:"order not found"}}
        const response = priceLevelData.removeNode(orderNode);
        if(!response.success){
            //we nee to remove the price level
            this.asks.delete(priceLevel);
            console.log("removed the price Level")
            
        }
        this.ordersRef.delete(order.orderId);
        return { success:"true",message:"removed order"}

    }

    removeBuyOrder(order:Order){
        //we need to remove the orderRef
        //we need to remove the level if dll have only one order also
        const priceLevel = order.price;
        const priceLevelData = this.bids.get(priceLevel);
        if(priceLevelData === undefined){
            return { succes:true,message:"price level not found"};

        }
        const levelList = priceLevelData.list;
        let orderNode = this.ordersRef.get(order.orderId);
        if(orderNode === undefined){ return {success:true,message:"order not found"}}
        const response = priceLevelData.removeNode(orderNode);
        if(!response.success){
            //we nee to remove the price level
            this.bids.delete(priceLevel);
            console.log("removed the price Level")
            
        }
        this.ordersRef.delete(order.orderId);
        return { success:"true",message:"removed order"}

    }
    matchOrder(order:Order){
    const { qty,price } = order;

    const matchedOrders:MatchOrder[]=[];
    //get the pricelevel for asks
    let opSidelevelData= order.side === "LONG"?this.asks.get(order.price):this.bids.get(order.price);
    if(opSidelevelData === undefined){
        //no opposite price level present for the asset ,so put order in  this
        order.side === "LONG"?this.addBidOrder(order):this.addAskOrder(order);
        let updates={
            bids:order.side === "LONG"?[[price.toString(),qty.toString()]]:[[]],
            asks:order.side === "SHORT"?[[price.toString(),qty.toString()]]:[[]]

        }
        return {
            event:"ORDER_ACCEPTED",
            payload:{
                filled:order.filled,
                updates,
                matchedOrders
                
            }};
    }
    
    //if level avialable ---> we can match the order and execute the order --->add to position or open new position
    const ordersLength = opSidelevelData.list.length;
  
    for(let index = 0; index < ordersLength;index++){
        const requiredQty = order.qty - order.filled;
        const matchedOrder = opSidelevelData.list.getFirstOrder().value;
        const availablleQty = matchedOrder.qty- matchedOrder.filled;
   
        if(requiredQty <= availablleQty){
          matchedOrder.filled += requiredQty;
          order.filled += requiredQty;
        }else{
         matchedOrder.filled += availablleQty;
         order.filled += availablleQty;
        }
        matchedOrders.push({
            userId:matchedOrder.userId,
            price:matchedOrder.price,
            leverage:matchedOrder.leverage,
            orderId:matchedOrder.orderId,
            qtyTransfered:matchedOrder.filled,
            side:matchedOrder.side,
            timestamp:Date.now().toString()})
        if(matchedOrder.filled === matchedOrder.qty ){
            //order is filled completely so the order is removed from the pricelevel
            matchedOrder.side === "SHORT"?this.removeAskOrder(matchedOrder):this.removeBuyOrder(matchedOrder);
        }
        if(order.filled === order.qty){

            //changes happend in the oppist side
            let updates={
            bids:matchedOrder.side === "LONG"?[[price.toString(),opSidelevelData.totalQty.toString()]]:[[]],
            asks:matchedOrder.side=== "SHORT"?[[price.toString(),opSidelevelData.totalQty.toString()]]:[[]]

        }
            
            return { event:"ORDER_FILLED",
                    payload:{
                        filled:order.filled,
                        matchedOrders,
                        updates
                    },

                    }
        }
        

    }

    if(order.filled != order.qty){
        //place in the order book:
        order.side === "LONG"?this.addBidOrder(order):this.addAskOrder(order);

    }

    //now we have maker updates and taker updates-->is it really, we matched opside sum executed--> opside level become 0 and order qty raise in taker account
    //asks and bids for updates
    //taker -> asks and bids[[price,qty]]
    //maker -> asks and bids [[price,0]]
    let bids:string[][]=[];
    let asks:string[][]=[];
    if(order.side === "SHORT"){
        //taker have some ask qty:
        const leveldata = this.asks.get(order.price)!;
        const qty = leveldata.totalQty.toString();
        asks.push([price.toString(),qty]);
        bids.push([price.toString(),opSidelevelData.totalQty.toString()]);

    }else{
        
        const leveldata = this.bids.get(order.price)!;
        const qty = leveldata.totalQty.toString();
        bids.push([price.toString(),qty]);
        asks.push([price.toString(),opSidelevelData.totalQty.toString()]);

    }
    return { event:"ORDER_FILLED_PARTIALLY",
        payload:{
            filled:order.filled,
            updates:{
                asks,
                bids
            },
            matchedOrders}};
    }
    matchMarketOrder(order:Order){
        const { qty,price,side,status,userId} = order;
      
        let totalLevels = order.side === "SHORT"?this.askTree.getLength():this.bidTree.getLength()
        const matchedOrders:MatchOrder[]=[];
        let takertax = 0n;
        let bids:string[][]=[];
        let asks:string[][]=[];
        for(let i =0; i< totalLevels;i++ ){
            //get the pricelevel from opposite side
            const level = order.side === "SHORT"?this.bidTree.getTop():this.askTree.getMinAsk();
            if(level === undefined){
                return  rejectOrderResponse("no counter offers",{...order,marketId:order.assetId})
            }
            let opSidelevelData= order.side === "LONG"?this.asks.get(level):this.bids.get(level);
            if(opSidelevelData === undefined){
                //no opposite price level present for the asset ,so reject he market Order
                order.side === "LONG"?this.addBidOrder(order):this.addAskOrder(order);
                return rejectOrderResponse("no counter offers",{...order,marketId:order.assetId})
            }
            
            //ask level avialable ---> we can match the order and execute the order --->add to position or open new position
            const ordersLength = opSidelevelData.list.length;
         
            for(let index = 0; index < ordersLength;index++){

                const requiredQty = order.qty - order.filled;
                const matchedOrder = opSidelevelData.list.getFirstOrder().value;
                const availablleQty = matchedOrder.qty- matchedOrder.filled;
                
                //executing the order
                if(requiredQty <= availablleQty){
                    matchedOrder.filled += requiredQty;
                    order.filled +=requiredQty;

                }else{
                   matchedOrder.filled += availablleQty;
                   order.filled += availablleQty;
                }
                
                 matchedOrders.push({
                    price:matchedOrder.price,
                    leverage:matchedOrder.leverage,
                    side:matchedOrder.side,
                    userId:matchedOrder.userId,
                    orderId:matchedOrder.orderId,
                    qtyTransfered:matchedOrder.filled,
                    timestamp:Date.now().toString()})
  
                if(matchedOrder.filled === matchedOrder.qty ){
                    //order is filled completely so the order is removed from the pricelevel
                    matchedOrder.side === "SHORT"?this.removeAskOrder(matchedOrder):this.removeBuyOrder(matchedOrder);
                }
                if(order.filled === order.qty){
                        let updates={
                                        bids:matchedOrder.side === "LONG"?[[price.toString(),opSidelevelData.totalQty.toString()]]:[[]],
                                        asks:matchedOrder.side=== "SHORT"?[[price.toString(),opSidelevelData.totalQty.toString()]]:[[]]
                                    }
                    return { 
                        event:"ORDER_FILLED" ,
                         payload:{
                            tax:takertax,
                            type:order.type,
                            qty:qty,
                            state:"FILLED",
                            userId,
                            side ,
                            marketId:order.assetId,
                            orderId:order.orderId,
                            filled:order.qty,
                            price:order.price,
                            matchedOrders,
                            updates}}
                }
            
        }
          if(order.side === "SHORT"){
        bids.push([price.toString(),opSidelevelData.totalQty.toString()]);

    }else{
        asks.push([price.toString(),opSidelevelData.totalQty.toString()]);

    }
    }
        return {
             event:"ORDER_FILLED_PARTIALLY",
              payload:{
                tax:takertax,
                type:order.type,
                qty:qty,
                state:"FILLED",
                userId,
                side ,
                marketId:order.assetId,             
                orderId:order.orderId,
                filled:order.qty,
                price:order.price,
                matchedOrders,
                updates:{
                    asks,bids
                }
            }}

   }


}


 

    


