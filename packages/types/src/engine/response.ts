import type { OrderSide, TransmitOrder } from "../domain/order";


export interface CreateUserResponse{
    success?:boolean;
    error?:string;
    userId:string;
    message?:string
}

export interface DeleteOrderResponse{
    success:boolean,
    error?:string,
    message?:string,
    orderId:string,
    marketId:string,
    updates?:{
        uid:number,
        asks:string[][],
        bids:string[][]
    }

}

export interface MatchOrder{
    price:bigint,
    orderId:string,
    userId:string,
    qtyTransfered:bigint,
    timestamp:string,
    leverage:bigint,
    side:OrderSide,
    tax:bigint
}

export interface TransmitMatchOrder{
    price:string,
    orderId:string,
    userId:string,
    qtyTransfered:string,
    timestamp:string,
    leverage:string,
    side:OrderSide,
    tax:string
}
export interface OrderFilledResponse extends TransmitOrder{
   
    matchedOrders:TransmitMatchOrder[],
    leverage:string,
    maintenanceMargin:string,
    initialMargin:string,
    tax:string,
    updates:{uid:number,asks:string[][],bids:string[][]}
}

export interface OrderAcceptedResponse extends TransmitOrder{
    message:string,
    timestamp:string,
    updates:{
        uid:number,
        asks:string[][],
        bids:string[][]
    }
    
}

export interface OrderRejectedResponse extends TransmitOrder{
    error:string,
    leverage:string,
    timestamp:string
    
}

export interface GetDepthResponse{
    success:boolean,
    error?:string,
    data?:{uidAtSnapshot:number,asks:string[][],bids:string[][]}
}

export interface TransmitPosition{
    id:string,
    userId:string,
    side:string,
    state:string,
    qty:string,
    avgPrice:string,
    liquidationPrice:string,
    initialMargin:string,
    markPrice:string,
    unrealizedPnL:string,
    mmr:string
}

export interface ClosedPositionsResponse{
    success:boolean,
    error?:string,
    data ?: {
        positions:TransmitPosition[]
    }
    
}

export interface GetEquityResponse{
    success:boolean,
    error?:string,
    data ?: {
        equity:string
    }
    
}

export interface OpenPositionsResponse{
    success:boolean,
    error?:string,
    data ?: {
        positions:TransmitPosition[]
    }
}



export interface RampUserResponse{
    error?:string,
    message?:string,
    totalBalance?:string
    
}
export interface CreateMarketResponse{
    
}

export interface OrderFilledPartiallyResponse extends OrderFilledResponse{
    
}

export interface SnapshotEvent{
    snapshot:string,
    lastEventId:string,
    liquidationCounters:Record<string,string>,
    streamId:string,
    timestamp:number
}

export interface RestoreSnapshotResponse{
    success:boolean,
    error?:string
}
