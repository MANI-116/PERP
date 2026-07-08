import type { OrderSide, OrderType } from "../domain/order";

export interface CreateUserRequest{
    userId:string,
}
export interface GetDepthRequest{
    marketId:string
}

export interface CreateMarketRequest{
    marketId:string;
}
export interface DeleteOrderRequest{
    marketId:string,
    orderId:string
}


export interface RampUserRequest{
    userId:string,
    credit:BigInt
}

export interface GetPositionsRequest{
    userId:string,
    marketId:string
}

export interface GetEquityRequest{
    userId:string
}

export interface CreateOrderRequest{
    type:OrderType,
    marketId:string
    userId:string,
    side:OrderSide,
    leverage:bigint,
    qty:bigint,
    price:bigint,
    orderId:string,
    liquidationId?:string
}

export interface RestoreSnapshotRequest{
    snapshot:string,
    lastEventId:string,
    liquidationCounters:Record<string,string>
}

export interface CreateOrderCommand{
    type:OrderType,
    marketId:string
    userId:string,
    side:OrderSide,
    leverage:string,
    qty:string,
    price:string,
    orderId:string
}




// export interface EngineRequest{
//     type:"CREATE_ORDER"|"CREATE_USER"|"RAMP_USER"|"CREATE_MARKET"|"UPDATE_MARKET"|"DELETE_ORDER",
//     payload:CreateUser|EngineCreateOrder|CreateMarket|DeleteOrder
//     corelationId:string
// }

// export interface CreateMarketRequest{
//     name: string;
//     symbol: string;
//     slug: string;
//     scale: string;
//     markPrice: string;
//     takerRate: string;
//     makerRate: string;
//     mmr: string;

// }
