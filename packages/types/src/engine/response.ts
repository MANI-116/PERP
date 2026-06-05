import { Position } from "@repo/engine-package"
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
    updates?:{
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
    side:OrderSide
}
export interface OrderFilledResponse extends TransmitOrder{
    availbleBalance:string,
    tax:string
    matchedOrders:MatchOrder[],
    updates:{asks:string[][],bids:string[][]}
}

export interface OrderAcceptedResponse extends TransmitOrder{
    message:string,
    timestamp:string,
    totalLocked:string,
    updates:{
        asks:string[][],
        bids:string[][]
    }
    
}

export interface OrderRejectedResponse extends TransmitOrder{
    error:string,
    timestamp:string
    
}

export interface GetDepthResponse{
    success:boolean,
    error?:string,
    data?:{asks:string[][],bids:string[][]}
}

export interface ClosedPositionsResponse{
    success:boolean,
    error?:string,
    data ?: {
        positions:Position[]
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
        positions:Position[]
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
