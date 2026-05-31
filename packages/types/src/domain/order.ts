export type Direction = "1"|"-1"

export type OrderType = "LIMIT"| "MARKET"

export type OrderStatus = "FILLED"|"PARTIALLY_FILLED"|"CANCELED"|"OPEN"

export type OrderSide = "SHORT" | "LONG"

export interface TransmitOrder{
    orderId:string,
    state:OrderStatus,
    side:OrderSide,
    type:OrderType,
    qty:string,
    filled:string,
    slippage?:string,
    price:string,
    marketId:string,
    userId:string
  
}

export interface Order{
    orderId:string,
    state:OrderStatus,
    side:OrderSide,
    type:OrderType,
    qty:bigint,
    filled:bigint,
    slippage?:bigint,
    price:bigint,
    marketId:string,
    userId:string
  
}