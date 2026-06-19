import type { CreateOrderRequest, EngineResponse, OrderAcceptedResponse, OrderRejectedResponse } from "@repo/types"
import { Order } from "../structures/order"

export function rejectOrderResponse(error:string,payload:CreateOrderRequest):{event:"ORDER_REJECTED",payload:OrderRejectedResponse}{
    return {
            event:"ORDER_REJECTED",
            payload:{
                error:error,
                timestamp:Date.now().toString(),
                ...payload,
                qty:payload.qty.toString(),
                price:payload.price.toString(),
                filled:"0n",
                state:"CANCELED"} }
}

export function acceptOrderResponse(order:Order,updates:{asks:string[][],bids:string[][]}):{event:"ORDER_ACCEPTED",payload:OrderAcceptedResponse}{
    return  {
            event:"ORDER_ACCEPTED",
            payload:{
                type:order.type,
                qty:order.qty.toString(),
                price:order.price.toString(),
                state:order.status,
                userId:order.userId,
                filled:0n.toString(),
                side:order.side ,
                marketId:order.assetId,
                orderId:order.orderId,
                message:"order placed fully in the book",
                timestamp:Date.now().toString(),
                updates:updates
                
            }}

}