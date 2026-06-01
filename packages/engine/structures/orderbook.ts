import  { AskTree } from "./askstree";
import  { BidTree } from "./bidstree";
import  { Dll, Node } from "./dll";
import type { Id, Market, Qty } from "@repo/types";

import  { Order } from "./order";
import  { PriceLevelObject } from "./priceLevelData";
import { Position} from "./position"
import { z } from "zod";
import {  priceLevelSnapshotSchema } from "./priceLevelData";
import { dllSnapshortSchema, nodeSnapshotSchema } from "./dll";

interface GiveSnapshot{
    giveSnapshot():string
}

type SnapshotFactory<T> = (valueSnapshotStr: string,market:Market) => T | null;


const orderSnapshotSchema = z.object({
    asks:z.array(z.object({price:z.string().transform((p)=>BigInt(p)),
        levelDataSnapshotString:z.string()
    })),
    bids:z.array(z.object({price:z.string().transform((p)=>BigInt(p)),
        levelDataSnapshotString:z.string()
    })),
    shorts:z.array(z.object({price:z.string().transform((p)=>BigInt(p)),
        levelDataSnapshotString:z.string()
    })),
    longs:z.array(z.object({price:z.string().transform((p)=>BigInt(p)),
        levelDataSnapshotString:z.string()
    })),
    askTree:z.array(z.string().transform((p)=>BigInt(p))),
    bidTree:z.array(z.string().transform((p)=>BigInt(p))),
    shortsTree:z.array(z.string().transform((p)=>BigInt(p))),
    longsTree:z.array(z.string().transform((p)=>BigInt(p))),
    assetId:z.string()})

export class OrderBook{
    public asks:Map<bigint,PriceLevelObject<Order>>;
    public bids:Map<bigint,PriceLevelObject<Order>>;
    public askTree:AskTree;
    public bidTree:BidTree;
    public longsTree:BidTree;
    public shortsTree:AskTree;
    private ordersRef:Map<string,Node<Order>>
    public longs:Map<bigint,PriceLevelObject<Position>>
    public shorts:Map<bigint,PriceLevelObject<Position>>
    public positionsRef:Map<string,Node<Position>>
    constructor(private readonly assetId:string){
        this.asks = new Map<bigint,PriceLevelObject<Order>>();
        this.bids = new Map<bigint,PriceLevelObject<Order>>();
        this.askTree  = new AskTree();
        this.bidTree = new BidTree();
        this.longsTree = new BidTree();
        this.shortsTree = new AskTree();
        this.ordersRef = new Map<string,Node<Order>>();
        this.longs = new Map<bigint,PriceLevelObject<Position>>();
        this.shorts = new Map<bigint,PriceLevelObject<Position>>();
        this.positionsRef = new Map<string,Node<Position>>();
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
        const longsTree = this.longsTree.clone();
        const shortsTree = this.shortsTree.clone();

        
         let longs:{price:string,levelSnapshotString:string}[]=[];
        for(const [price,priceLevelData] of this.longs.entries() ){
            const entry = {price:price.toString(),levelSnapshotString:priceLevelData.giveSnapshot()};
            longs.push(entry);
        }
        
         let shorts:{price:string,levelSnapshotString:string}[]=[];
        for(const [price,priceLevelData] of this.shorts.entries() ){
            const entry = {price:price.toString(),levelSnapshotString:priceLevelData.giveSnapshot()};
            shorts.push(entry);
        }
         let ordersRef:{orderId:string,orderSnapshot:string}[]=[];
        for(const [orderId,orderNode] of this.ordersRef.entries() ){
            const entry = {orderId:orderId,orderSnapshot:orderNode.giveSnapshot().valueSnapshot};
            ordersRef.push(entry);
        }

        let positionsRef:{lp:string,positionSnapshot:string}[]=[];
        for(const [lp,position] of this.positionsRef.entries() ){
            const entry = {lp:lp.toString(),positionSnapshot:position.giveSnapshot().valueSnapshot};
            positionsRef.push(entry);
        }

        return {orderSnapshotString:JSON.stringify({asks,bids,shorts,longs,askTree,bidTree,shortsTree,longsTree,assetId:this.assetId})};

    }

    static createLevelMap<T extends Qty & GiveSnapshot & Id>(
        priceLevel: {price: bigint;levelDataSnapshotString: string;},
        priceLevelMap:Map<bigint,PriceLevelObject<T>>,
        market:Market,
        createFromSnapshot: SnapshotFactory<T>,
        ref:Map<string,Node<T>>
     ){
        const { price , levelDataSnapshotString} = priceLevel;
            const parseData = priceLevelSnapshotSchema.safeParse(JSON.parse(levelDataSnapshotString));
            if(!parseData.success){
                return { success:false, error:"levelDataSnapshotString got corrupted"}
            }
            const {totalQty,length,listSnapshortString} = parseData.data;
            const listParseData =  dllSnapshortSchema.safeParse(JSON.parse(listSnapshortString));
            if(!listParseData.success){
                return { success:false, error:"listSnapshotString corrupted"}
            }
            let list:Dll<T>;
            const listSnapshot = listParseData.data;
            const { snapshorts } = listSnapshot;
            snapshorts.map((s)=>{
                const parseData = nodeSnapshotSchema.safeParse(JSON.parse(s));
                if(!parseData.success){
                    return { success:false, error:"nodeSnapshot is corrupted"}
                }
                const nodeValueSnapshotString  = parseData.data;
                const nodeValue = createFromSnapshot(nodeValueSnapshotString.valueSnapshot,market);
                if(!nodeValue){
                    return { success:false, error:"nodeValuesnapshot got corrupted"}
                }
                if(list === undefined){
                    const node = new Node<T>(nodeValue);
                    ref.set(node.value.id ,node)
                    list = new Dll(node)
                }else{
                    const node = new Node<T>(nodeValue);
                    ref.set(node.value.id ,node)

                    list.addNode(node);
                }

            })
            const priceLevelData =  PriceLevelObject.createFromSnapShort<T>(totalQty,length,list!);
            priceLevelMap.set(price,priceLevelData);

    }

    static createFromSnapshot(orderSnapshotString:string,market:Market){
        const parseData = orderSnapshotSchema.safeParse(JSON.parse(orderSnapshotString));
        if(!parseData.success){
            return null;
        }

        const orderbookSnapshot = parseData.data;

        //create the new order book;
        //create new asks tree,bids tree , shorts tree , longs tree
        const assetId = orderbookSnapshot.assetId;
        const askTree = AskTree.create(orderbookSnapshot.askTree);
        const shortsTree = AskTree.create(orderbookSnapshot.shortsTree);
        const bidTree = BidTree.create(orderbookSnapshot.bidTree);
        const longsTree = BidTree.create(orderbookSnapshot.longsTree);

        const ordersRef = new Map<string,Node<Order>>();
        const positionsRef = new Map<string,Node<Position>>();
        const asks = new Map<bigint,PriceLevelObject<Order>>()
         orderbookSnapshot.asks.forEach((ask)=> OrderBook.createLevelMap<Order>(ask,asks,market,Order.createFromSnapshot,ordersRef))
        const bids = new Map<bigint,PriceLevelObject<Order>>()
         orderbookSnapshot.bids.forEach((bid)=>OrderBook.createLevelMap<Order>(bid,bids,market,Order.createFromSnapshot,ordersRef))
        const shorts = new Map<bigint,PriceLevelObject<Position>>()
         orderbookSnapshot.shorts.forEach((short)=>OrderBook.createLevelMap<Position>(short,shorts,market,Position.createFromSnapshot,positionsRef))
        const longs = new Map<bigint,PriceLevelObject<Position>>()
         orderbookSnapshot.longs.forEach((long)=>OrderBook.createLevelMap<Position>(long,longs,market,Position.createFromSnapshot,positionsRef)) 

         const orderbook = new OrderBook(assetId);
         orderbook.asks = asks;
         orderbook.bids = bids;
         orderbook.askTree = askTree;
         orderbook.bidTree = bidTree;
         
         orderbook.shorts = shorts;
         orderbook.longs = longs;
         orderbook.shortsTree= shortsTree;
         orderbook.longsTree = longsTree;
         orderbook.ordersRef = ordersRef;
         orderbook.positionsRef=positionsRef;


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
    addShortLiquidationPrice(price:bigint){
       return  this.shortsTree.addPrice(price);
    }
    addLongLiquidationPrice(price:bigint){
       return  this.longsTree.addPrice(price);
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

    addLong(position:Position){
        const liquidationPrice = position.liquidationPrice;

        //if we have the pricelevel 
        let levelData = this.longs.get(liquidationPrice);
        let positionRef:Node<Position>
        if(levelData === undefined){
        //-->  create the the pricelevel and add postion and add level to the longsTree
            levelData = PriceLevelObject.createFromOrder<Position>(position);
            this.longs.set(liquidationPrice,levelData);
            positionRef = levelData.list.getFirstOrder();
            this.longsTree.addPrice(liquidationPrice);

        }else{
            //-->then added it to the list add postion reference to positionrefmap 
            positionRef = new Node<Position>(position)
            levelData.list.addNode(positionRef);
            
        }
        //add the reference to the map
        this.positionsRef.set(positionRef.value.id,positionRef);
        return { message:"added successfully"};

    }

    addShort(position:Position){
        const liquidationPrice = position.liquidationPrice;

        //if we have the pricelevel 
        let levelData = this.shorts.get(liquidationPrice);
        let positionRef:Node<Position>
        if(levelData === undefined){
        //-->  create the the pricelevel and add postion and add level to the longsTree
            levelData =  PriceLevelObject.createFromOrder<Position>(position);
            this.shorts.set(liquidationPrice,levelData);
            positionRef = levelData.list.getFirstOrder();
            this.shortsTree.addPrice(liquidationPrice);

        }else{
            //-->then added it to the list add postion reference to positionrefmap 
            positionRef = new Node<Position>(position)
            levelData.list.addNode(positionRef);
            
        }
        //add the reference to the map
        this.positionsRef.set(positionRef.value.id,positionRef);
        return { message:"added successfully"};

    }

    removeShort(position:Position ,lp?:bigint){
        //get the level
        // ******** lp is for the postions which transitioned from the short to long
        //single order remove level,remove ref and remove treePrice check wether positon is long or short
        const level = lp? this.shorts.get(lp): this.shorts.get(position.liquidationPrice);
        if(level === undefined){ return { success:false, message:"position doesnot exist"}};
        //get the reference of the position
        const posRef = this.positionsRef.get(position.id);
        if(posRef === undefined){
            return { success:false, message:"no position found"}
        }
        const response = level.list.removeNode(posRef);
        if(!response.success){
            //single order ,need to remove the whole level and levelprice in the shorts tree
            console.log("removing level and the pprice in tree")
            this.shorts.delete(position.liquidationPrice);
            this.shortsTree.removePrice(position.liquidationPrice);
            this.positionsRef.delete(position.id);
            return {success:true,message:"position removed succesfully"}
        }
        this.positionsRef.delete(position.id);
        return { success:true, message:"removed the postion"}
        

    }

    removeLong(position:Position,lp?:bigint){
        //get the level
        //single order remove level,remove ref and remove treePrice
        const level =lp?this.longs.get(lp): this.longs.get(position.liquidationPrice);
        if(level === undefined){ return { success:false, message:"position doesnot exist"}};
        //get the reference of the position
        const posRef = this.positionsRef.get(position.id);
        if(posRef === undefined){
            return { success:false, message:"no position found"}
        }
        const response = level.list.removeNode(posRef);
        if(!response.success){
            //single order ,need to remove the whole level and levelprice in the longs tree
            console.log("removing level and the pprice in tree")
            this.longs.delete(position.liquidationPrice);
            this.longsTree.removePrice(position.liquidationPrice);
            this.positionsRef.delete(position.id);
            return {success:true,message:"position removed succesfully"}
        }
        this.positionsRef.delete(position.id);
        return { success:true, message:"removed the postion"}

    }

    

}
