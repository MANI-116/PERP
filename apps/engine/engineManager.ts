import type { DeleteOrderResponse, CreateMarketResponse, RampUserResponse, EngineResponse, CreateUserResponse,  } from "@repo/types";
import { matchingEngine } from "./matchingEnigne";
import {  orderBooks,markets } from "./sharedResourcesManager";
import { liquidationEngine } from "./liquidationEngine";
import {  User} from "@repo/engine-package"
import { UserManager,MarketManager } from "./sharedResourcesManager";

const userManager = UserManager.create();
const marketManager = MarketManager.create();

function createUser(user:User):CreateUserResponse{
    const response = userManager.addUser(user);
   return {...response,userId:user.userId};
}

function createMarket(marketId:string):CreateMarketResponse{
  return marketManager.addMarket({marketId,markPrice:0n,mmr:5n,takerRate:5n,makerRate:2n,taxationScale:3n,symbol:"SOLUSDT"});

}

function deleteOrder(orderId:string,assetId:string):DeleteOrderResponse{
    const orderBook = orderBooks.get(assetId);
    if(!orderBook){
        return {success:false,error:"orderbook not found", orderId};
    }


    const response = orderBook.deleteOrder(orderId);
    return { ...response, orderId};

}

function rampUser({userId,credit}:{userId:string,credit:bigint}):RampUserResponse{
    const response = userManager.rampUser(userId,credit);
    return {...response};
}


function getEquity(userId:string){
    const response = userManager.getUserEquity(userId);
    return { ...response}
}

function getOpenPositions(userId:string){
 const response = userManager.getPositions(userId);
 return response;
}


export function engineManager(request:any):EngineResponse|null{

    request.payload = JSON.parse(request.payload);
    console.log("message from the sreams-",request);

    switch(request.type){
        case "CREATE_ORDER":{
            console.log("create order is invoked");
          const payload = { ...request.payload, price:BigInt(request.payload.price),qty:BigInt(request.payload.qty),leverage:BigInt(request.payload.leverage)}        
          return  matchingEngine(payload)
        }
        case "CREATE_USER":{
            const {userId} = request.payload;
            const payload = createUser(userId);
            return {event:"CREATE_USER",payload}
        }
        
        case "CREATE_MARKET":{
            const { marketId} = request.payload;
            const payload = createMarket(marketId);
             return {event:"CREATE_MARKET",payload};
        }       
        case "RAMP_USER":{
            const {userId,credit}=request.payload;
            const payload = rampUser({userId,credit});
            return { event:"RAMP_USER",payload};    
        }
        case "DELETE_ORDER":{
            const { orderId,marketId  } = request.payload
            const response = deleteOrder(orderId,marketId);
            return { event:"DELETE_ORDER",payload:response};
        }

        case "GET_OPEN_POSITIONS":{
            const { userId} = request.payload;
            const response = getOpenPositions(userId);
            return {event:"GET_OPEN_POSITIONS",payload:response}
        }
            break;
        case "GET_EQUITY":{
            const response = getEquity(request.payload.userId);
            return {event:"GET_EQUITY",payload:response};
        }
        case "UPDATE_MARKPRICE":{
            const { symbol,markPrice } =request.payload;
            const market = markets.filter((m)=>m.symbol === symbol)[0];
            if(market){ 
                console.log("starting liquidation engine-",symbol);
                liquidationEngine({marketId:market.marketId,markPrice});
            }
        }
        break;
        case "GET_DEPTH":{
            const {marketId} = request.payload;
            const response = getDepth(marketId);
            return {event:"GET_DEPTH",payload:response};
        }
        break;
    }
    throw new Error("no request type matched");


}


function getDepth(marketId:string){

    const orderBook = orderBooks.get(marketId);
    if(!orderBook){
        return { success:false,error:"no orderbook found"};
    }

    const bids = [...orderBook.bids.entries()].sort((a,b)=>{if(a[0]<b[0]){return -1}else if(a[0] > b[0]){ return 1} return 0;}).map((e)=>{
        return [e[0].toString(),e[1].totalQty.toString()]
    });

    const asks = [...orderBook.asks.entries()].sort((a,b)=>{if(a[0]<b[0]){return -1}else if(a[0] > b[0]){ return 1} return 0;}).map((e)=>{
        return [e[0].toString(),e[1].totalQty.toString()]
    })

    return { success:true, data:{asks,bids}}
}

