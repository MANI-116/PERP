import { z } from "zod";
import { UserManager } from "./userManager";
import { MarketManager } from "./marketManager";
import type { CreateOrderRequest, EngineResponse, MatchOrder, OrderAcceptedResponse, OrderFilledPartiallyResponse,OrderRejectedResponse,OrderFilledResponse } from "@repo/types";
import type { Market } from "./market";
import { Order } from "./order";
import { rejectOrderResponse, acceptOrderResponse } from "../lib/placeOrderResponses";
type createOrderResponse = OrderAcceptedResponse | OrderFilledPartiallyResponse | OrderFilledResponse | OrderRejectedResponse


const engineSnapshotschema = z.object({ 
    userManagerSnapshot:z.string(),
    marketManagerSnapshot:z.string(),
     })

export class Engine{
    private userManager:UserManager
    private marketManager:MarketManager
    private static engine:Engine| null;
    private exchangeMarketBalance=0n;
    static reset() {
    Engine.engine = null;
}
    
    constructor(){
        this.userManager = UserManager.create();
        this.marketManager = MarketManager.create();
    }

    static create(){
        if(Engine.engine){
            return Engine.engine;
        }

        Engine.engine = new Engine();
        return Engine.engine;
    }
    getSnapshot(){
        const userManagerSnapshot = this.userManager.giveSnapshot();
        const marketManagerSnapshot = this.marketManager.giveSnapshot();

        return JSON.stringify({ userManagerSnapshot,marketManagerSnapshot});
    }

     static createFromSnapshot(snapshotString:string){
        const parseData = engineSnapshotschema.safeParse(JSON.parse(snapshotString));
        if(!parseData.success){
            return null;
        }
        const snapshot = parseData.data;
        const engine = Engine.create();
        const marketManager = MarketManager.createFromSnapshot(snapshot.marketManagerSnapshot);
        if(!marketManager){
            return null;

        }
        const userManager = UserManager.createFromSnapshot(snapshot.userManagerSnapshot);

        if(!userManager) return null;
        engine.userManager = userManager;
        engine.marketManager = marketManager;

        return engine;
    }
    handleBankRuptcy(position:string,amount:bigint){
        //TODO handle exchange balance
        this.exchangeMarketBalance -= amount;
        if(this.exchangeMarketBalance < 0){
            //TODO ---> perform ADL
        }


    }

       /**
                     * this is for matching orders 
                     * the matched order is in the book
                     * for this market user either have a position
                     * -->yes
                     * either this order will increase the qty or decrese or reverse position direction
                     * -->no
                     * we just need to create the positions ,now user position will be opened
                     */
    matchOrderExecution(makerOrder:MatchOrder,market:Market){
            //userId,marketId,price
      
                const response = this.userManager.getPosition(makerOrder.userId,market.marketId);
                if(!response.success && response.error === "user not found"){

                     throw new Error('user not found');
                }
                if(!response.success){
                    //no existing position
                    
                    const initialMargin = (makerOrder.price * makerOrder.qtyTransfered) /makerOrder.leverage
                    //cut intialMargin from the user
                    const debitRes = this.userManager.debitLockAmount(makerOrder.userId,initialMargin);
                    if(!debitRes.success){
                        //exeception occured locked balace logic mismatch
                        throw new Error("locked balance logic got skewed");
                    }

                    //create new position and need deduct the initial margin from the user plus transaction charge(maker)
                    const {positionId} = market.createPosition(makerOrder.userId,makerOrder.qtyTransfered,makerOrder.price,makerOrder.side,initialMargin);
                    this.userManager.addPosition(makerOrder.userId,market.marketId,positionId);      


                    //cut tax from the position initial margin
                    const tax = market.calculatetax(makerOrder.qtyTransfered*makerOrder.price,"maker");
                    const taxcutResponse =market.cutInitialMargin(positionId,tax);
                    if(!taxcutResponse.success){
                        this.handleBankRuptcy(positionId,tax);
                    };
                    this.exchangeMarketBalance += tax;
                  

                }else{
                    //existing position ---> need to update the positions and settle the remaining 
                    //for settling things ---> update can be sane side,different side
                    let makerPositionId = response.positionId!;
                    
                    //cut tax from the position initial margin for the fill
                    const tax = market.calculatetax(makerOrder.qtyTransfered*makerOrder.price,"maker");
                    const taxcutResponse =market.cutInitialMargin(makerPositionId,tax);
                    if(!taxcutResponse.success){
                        this.handleBankRuptcy(makerPositionId,tax);
                    }
                    this.exchangeMarketBalance += tax;

                    const getData = market.getData(makerPositionId,{keys:["avgPrice","side","initialMargin","qty","id"]});
                  
                      if(!getData.success){
                        return getData;

                    }
                    if(!getData.data){
                         return getData;

                    }
                    const { initialMargin:makerMargin,side:makerSide,qty:makerQty,avgPrice:makerPrice,id} = getData.data;
                    
                     market.updatePositions(response.positionId!,makerOrder.side,makerOrder.userId,makerOrder.price,makerOrder.leverage,makerOrder.qtyTransfered)
                    const notionalAmount = makerOrder.qtyTransfered * makerOrder.price;
                      //same side
                      if(makerOrder.side === makerSide){
                          //---> update the qty, need extra margin for newly updated qty
                          const extraMargin = notionalAmount / makerOrder.leverage;
                          const debitRes = this.userManager.debitLockAmount(makerOrder.userId,extraMargin);
                             if(!debitRes.success){
                            //exeception occured locked balace logic mismatch
                            throw new Error("locked balance logic got skewed");
                        }

                      }else{
                          //opposite side
                          //---->partial settelement---> settle for partial realizedPnL and taxation
                          if(makerQty >= makerOrder.qtyTransfered){
                                const direction = makerSide === "SHORT" ? -1n :1n;
                                 const realizedPnL = (makerOrder.price-makerPrice)*makerOrder.qtyTransfered*direction;
                                 const releasedMargin = (makerMargin*makerOrder.qtyTransfered)/makerQty; 
                                 const settlementAmount =  releasedMargin+ realizedPnL;
                                 
     
                                 if(settlementAmount < 0){
                                     return this.handleBankRuptcy(makerPositionId,settlementAmount);
                                 }
                                 this.userManager.rampUser(makerOrder.userId,settlementAmount);
                                 

                            }else{
                                //--->reverse ---> we have some margin before new Position, so settle that balance and have new margin -->
                                 const direction = makerSide === "SHORT" ? -1n :1n;
                                 const realizedPnL = (makerOrder.price-makerPrice)*(makerQty)*direction;
                                 const releasedMargin = makerMargin; 
                                 const settlementAmount =  releasedMargin + realizedPnL;
                                 if(settlementAmount < 0){
                                     this.handleBankRuptcy(makerPositionId,settlementAmount);
                                     return {
                                            success:false,
                                            reason:"INSUFFICIENT_MARGIN_AFTER_REALIZATION"
                                            }
                                 }
                                 this.userManager.rampUser(makerOrder.userId,settlementAmount);

                               
                                 //deduct the balance from the user locked:
                                 const openingQty = (makerOrder.qtyTransfered-makerQty)
                                 const initialMargin = (openingQty *makerOrder.price)/makerOrder.leverage;
                                 const debitRes = this.userManager.debitLockAmount(makerOrder.userId,initialMargin);
                         
                                 if(!debitRes.success){
                                        //exeception occured locked balace logic mismatch
                                        throw new Error("locked balance logic got skewed");
                                    }
                                 //margin is deducted now we need to create the new position:
                                const {positionId} = market.createPosition(makerOrder.userId,openingQty,makerOrder.price,makerOrder.side,initialMargin);   

                                 this.userManager.addPosition(makerOrder.userId,market.marketId,positionId);
                

                            }
                      }
                    //*** make sure we locked margin for the extra qty only */
                }
            
    }

    lockMargin(payload:CreateOrderRequest,market:Market):{success:false,error:string}|{success:true,message:string}{
            const sameMarketPosition = this.userManager.getPosition(payload.userId,market.marketId);
            if(sameMarketPosition.success){
                //check the side, if same side lock the balance else move on
                const getdataRes  = market.getData(sameMarketPosition.positionId,{keys:["side","qty"]});
                if(!getdataRes.success){
                    console.log("something went wrong");
                    return { success:false, error:"market unable to get side from the market"};
                }

                const { side,qty:positionQty } = getdataRes.data!;

                if(payload.side === side){
                    //lock margin
                    
                     let positionSize = 0n;
                     
                     if(payload.type === "MARKET"){
                         const estimatedPrice = market.calculateEstimatedPrice(payload.qty,payload.side);
                         if(estimatedPrice === 0n) return  {success:false,error:"unable to lock the balace"};

                         if(estimatedPrice === undefined) return {success:false,error:"unable to get the estimated price"} ;
                         positionSize = payload.qty*estimatedPrice;
            

                     }else{
                        positionSize = payload.qty*payload.price;

                     }
                     const initialMargin = positionSize/payload.leverage;  
                     if(!this.userManager.lockAmount(payload.userId,initialMargin) ){
                            return {success:false,error:"does not have enough balace"};
                        }
                        return { success:true,message:"locked the margin"};
                }else{

                     const openingQty =  payload.qty-positionQty;
                     const initialMargin = (openingQty*payload.price)/payload.leverage;  
                     if(!this.userManager.lockAmount(payload.userId,initialMargin) ){
                            return {success:false,error:"does not have enough balace"};
                        }
                        return { success:true,message:"locked the margin"};
                }
            }else{
                //no position existed, just lock the initial Margin
                let positionSize = 0n;
                     
                     if(payload.type === "MARKET"){
                         const estimatedPrice = market.calculateEstimatedPrice(payload.qty,payload.side);
                         if(estimatedPrice === 0n) return  {success:false,error:"unable to lock the balace"};

                         if(estimatedPrice === undefined) return {success:false,error:"unable to get the estimated price"} ;
                         positionSize = payload.qty*estimatedPrice;
            

                     }else{
                        positionSize = payload.qty*payload.price;

                     }
                     const initialMargin = positionSize/payload.leverage;  
                     if(!this.userManager.lockAmount(payload.userId,initialMargin) ){
                            return {success:false,error:"does not have enough balace"};
                        }
                        return { success:true,message:"locked the margin"};


            }
                 console.log("something went wrong");
         return { success:false,error:"position not found in market but existed in user"}

    }

    placeLimitOrder(payload:CreateOrderRequest,market:Market){

        //if user have existing position based on the qty either lock margin or skip locking mechanism
        
        //first check the balances and lock collateral or initial margin from the leverage took and maintenance margin
       
        const lockres = this.lockMargin(payload,market);
        if(!lockres.success) {return rejectOrderResponse(lockres.error,payload)};
        
        //create order
        const order = new Order(payload.orderId,payload.userId,payload.marketId,payload.qty,payload.side,payload.price,payload.leverage,"LIMIT");

        const response =  market.orderbook.matchOrder(order);
        if(response.event === "ORDER_ACCEPTED"){
            //TODO
            //@100xlong at 100 -->compler qty sit on the orderbook
            return acceptOrderResponse(order,response.payload.updates);

        }else if(response.event === "ORDER_FILLED"  || response.event === "ORDER_FILLED_PARTIALLY"){
            const matchedOrders = response.payload.matchedOrders;

            //update the matchedorders positions and manage the margins
            matchedOrders.forEach ((matchOrder)=>{
                this.matchOrderExecution(matchOrder,market);
            })

            //update taker positions and manage finances
            const result = this.matchOrderExecution({ 
                orderId:order.orderId,
                price:order.price,
                userId:order.userId,
                qtyTransfered:order.filled,
                timestamp:Date.now().toString(),
                leverage:order.leverage,
                side:order.side}, market)

                return response;
        


        }
        
    }

    placeMarketOrder(payload:CreateOrderRequest,market:Market){

        const lockres = this.lockMargin(payload,market);
        if(!lockres.success) { return rejectOrderResponse(lockres.error,payload)};
 
        const order = new Order(payload.orderId,payload.userId,payload.marketId,payload.qty,payload.side,0n,payload.leverage,"MARKET");
        const response = market.orderbook.matchMarketOrder(order);

         if(response.event === "ORDER_REJECTED"){
             return rejectOrderResponse("no counter offers exists",payload);
        
        }else if(response.event === "ORDER_FILLED"  || response.event === "ORDER_FILLED_PARTIALLY"){
            const matchedOrders = response.payload.matchedOrders;

            //update the matchedorders positions and manage the margins
            matchedOrders.forEach ((matchOrder)=>{
                this.matchOrderExecution(matchOrder,market);
            })

            //update taker positions and manage finances
             this.matchOrderExecution({ 
                orderId:order.orderId,
                price:order.price,
                userId:order.userId,
                qtyTransfered:BigInt(response.payload.filled),
                timestamp:Date.now().toString(),
                leverage:order.leverage,
                side:order.side}, market)

                return response;

        }
        
        return response;
        
    }
  
    placeOrder(payload:CreateOrderRequest){
    
        const market = this.marketManager.getMarket(payload.marketId); 
        const user = this.userManager.foundUser(payload.userId);
        if(user === undefined){
            console.log("bidder not found")
            return rejectOrderResponse("user not found",payload)
        }

        if(market === undefined){
            return rejectOrderResponse("market not found",payload);
        }
    
        if(payload.type === "LIMIT") return this.placeLimitOrder(payload,market);
        return this.placeMarketOrder(payload,market);
        
    }


}

