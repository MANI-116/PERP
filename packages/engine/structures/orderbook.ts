import  { AskTree } from "./askstree";
import  { BidTree } from "./bidstree";
import  { Node } from "./dll";
import  { Order } from "./order";
import  { PriceLevelObject } from "./priceLevelData";
import { Position} from "./position"

export class OrderBook{
    private assetId:string;
    public asks:Map<bigint,PriceLevelObject<Order>>;
    public bids:Map<bigint,PriceLevelObject<Order>>;
    public askTree:AskTree;
    public bidTree:BidTree;
    public longsTree:BidTree;
    public shortsTree:AskTree;
    private ordersRef:Map<string,Node<Order>>
    public longs:Map<bigint,PriceLevelObject<Position>>
    public shorts:Map<bigint,PriceLevelObject<Position>>
    private postionsRef:Map<string,Node<Position>>
    constructor(assetId:string){
        this.assetId = assetId;
        this.asks = new Map<bigint,PriceLevelObject<Order>>();
        this.bids = new Map<bigint,PriceLevelObject<Order>>();
        this.askTree  = new AskTree();
        this.bidTree = new BidTree();
        this.longsTree = new BidTree();
        this.shortsTree = new AskTree();
        this.ordersRef = new Map<string,Node<Order>>();
        this.longs = new Map<bigint,PriceLevelObject<Position>>();
        this.shorts = new Map<bigint,PriceLevelObject<Position>>();
        this.postionsRef = new Map<string,Node<Position>>();
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
            let newLevelData = new PriceLevelObject<Order>(order);
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
            const newLevelData = new PriceLevelObject<Order>(order);
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
            levelData = new PriceLevelObject<Position>(position);
            this.longs.set(liquidationPrice,levelData);
            positionRef = levelData.list.getFirstOrder();
            this.longsTree.addPrice(liquidationPrice);

        }else{
            //-->then added it to the list add postion reference to positionrefmap 
            positionRef = new Node<Position>(position)
            levelData.list.addNode(positionRef);
            
        }
        //add the reference to the map
        this.postionsRef.set(positionRef.value.id,positionRef);
        return { message:"added successfully"};

    }

    addShort(position:Position){
        const liquidationPrice = position.liquidationPrice;

        //if we have the pricelevel 
        let levelData = this.shorts.get(liquidationPrice);
        let positionRef:Node<Position>
        if(levelData === undefined){
        //-->  create the the pricelevel and add postion and add level to the longsTree
            levelData = new PriceLevelObject<Position>(position);
            this.shorts.set(liquidationPrice,levelData);
            positionRef = levelData.list.getFirstOrder();
            this.shortsTree.addPrice(liquidationPrice);

        }else{
            //-->then added it to the list add postion reference to positionrefmap 
            positionRef = new Node<Position>(position)
            levelData.list.addNode(positionRef);
            
        }
        //add the reference to the map
        this.postionsRef.set(positionRef.value.id,positionRef);
        return { message:"added successfully"};

    }

    removeShort(position:Position ,lp?:bigint){
        //get the level
        // ******** lp is for the postions which transitioned from the short to long
        //single order remove level,remove ref and remove treePrice check wether positon is long or short
        const level = lp? this.shorts.get(lp): this.shorts.get(position.liquidationPrice);
        if(level === undefined){ return { success:false, message:"position doesnot exist"}};
        //get the reference of the position
        const posRef = this.postionsRef.get(position.id);
        if(posRef === undefined){
            return { success:false, message:"no position found"}
        }
        const response = level.list.removeNode(posRef);
        if(!response.success){
            //single order ,need to remove the whole level and levelprice in the shorts tree
            console.log("removing level and the pprice in tree")
            this.shorts.delete(position.liquidationPrice);
            this.shortsTree.removePrice(position.liquidationPrice);
            this.postionsRef.delete(position.id);
            return {success:true,message:"position removed succesfully"}
        }
        this.postionsRef.delete(position.id);
        return { success:true, message:"removed the postion"}
        

    }

    removeLong(position:Position,lp?:bigint){
        //get the level
        //single order remove level,remove ref and remove treePrice
        const level =lp?this.longs.get(lp): this.longs.get(position.liquidationPrice);
        if(level === undefined){ return { success:false, message:"position doesnot exist"}};
        //get the reference of the position
        const posRef = this.postionsRef.get(position.id);
        if(posRef === undefined){
            return { success:false, message:"no position found"}
        }
        const response = level.list.removeNode(posRef);
        if(!response.success){
            //single order ,need to remove the whole level and levelprice in the longs tree
            console.log("removing level and the pprice in tree")
            this.longs.delete(position.liquidationPrice);
            this.longsTree.removePrice(position.liquidationPrice);
            this.postionsRef.delete(position.id);
            return {success:true,message:"position removed succesfully"}
        }
        this.postionsRef.delete(position.id);
        return { success:true, message:"removed the postion"}

    }

    

}
