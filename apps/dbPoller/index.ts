import { createClient } from "redis";
import { prisma} from "./lib/db"
import {  type EngineResponse } from "@repo/types"

const redisUrl = process.env.REDIS_URL
const receiver = createClient(redisUrl ? { url: redisUrl, socket: { tls: true, rejectUnauthorized: false } } : undefined);

interface RedisResponse{   
    name: string;
    messages: {
        id: string;
        message: {
            [x: string]: string;
        };
        millisElapsedFromDelivery?: number | undefined;
        deliveriesCounter?: number | undefined;
    }[]
}

receiver.on("error",(e)=>{
    console.log("error occured on connection to the redisstream-",e)
})

await receiver.connect();

try {
    await receiver.xGroupCreate("response-stream","dbPoller","0",{MKSTREAM:true})
} catch (error) {
    if(error instanceof Error)
    console.log("error on creating dbPOller group-",error.name,error.message);
    else console.log("unknown error-",error);
}

// Load last processed event ID from PostgreSQL on startup
let lastProcessedEventId = 0n;
try {
    const state = await prisma.engineState.findUnique({ where: { id: "singleton" } });
    if (state) {
        lastProcessedEventId = state.lastProcessedEventId;
        console.log("dbPoller: loaded lastProcessedEventId =", lastProcessedEventId.toString());
    }
} catch (error) {
    console.log("dbPoller: no existing engine state, starting fresh-", error);
}

// Catch-up: process all unprocessed existing messages before reading new ones
if (lastProcessedEventId === 0n) {
    console.log("dbPoller: catch-up phase starting...");
    let catchUpDone = false;
    while (!catchUpDone) {
        const batch = await receiver.xReadGroup("dbPoller","poller-1",[{key:"response-stream",id:"0"}],{COUNT:100}) as (RedisResponse[] |null);
        if (!batch || !batch[0]?.messages || batch[0].messages.length === 0) {
            catchUpDone = true;
            break;
        }
        for (const msg of batch[0].messages) {
            if (msg.message.message === undefined) {
                await receiver.xAck("response-stream","dbPoller",msg.id);
                continue;
            }
            const message = JSON.parse(msg.message.message) as EngineResponse;
            await dbWorker(message);
            if (message.event !== "SNAPSHOT" && message.eventId) {
                lastProcessedEventId = BigInt(message.eventId);
            }
            await receiver.xAck("response-stream","dbPoller",msg.id);
        }
        if ((batch[0]?.messages?.length ?? 0) < 100) catchUpDone = true;
    }
    console.log("dbPoller: catch-up phase complete");
}

while(true){
    const response = await receiver.xReadGroup("dbPoller","poller-1",[{key:"response-stream",id:">"}],{BLOCK:2000}) as (RedisResponse[] |null)
    if(response === null) continue;
  
    const stream = response[0];
    if(stream === undefined) continue;
    for(const msg of stream.messages){
        if(msg.message.message === undefined){
            await receiver.xAck("response-stream","dbPoller",msg.id);
            continue;
        }
        const message = JSON.parse(msg.message.message) as EngineResponse;

        console.log("message from the response stream-",message);
        await dbWorker(message);
        
        await receiver.xAck("response-stream","dbPoller",msg.id);
    }
}

async function dbWorker(message: EngineResponse) {
    switch(message.event){
        case "ORDER_FILLED_PARTIALLY":
            await updateOrder(message);
            break;        
        case "ORDER_FILLED":
            await updateOrder(message);
            break;
        case "ORDER_ACCEPTED":
            await updateOrder(message);
            break;
        case "ORDER_REJECTED":
            await updateOrder(message);
            break;
        case "DELETE_ORDER":
            await deleteOrder(message);
            break;
        case "SNAPSHOT":
            await storeSnapshot(message);
            break;
        case "CREATE_MARKET":
            await createMarket(message);
            break;
        case "CREATE_USER":
            await createUser(message);
            break;
    }
}

async function createUser(message:EngineResponse){

}
async function createMarket(message:EngineResponse){
    
}
async function storeSnapshot(message: EngineResponse) {
    try {
        if (message.event !== "SNAPSHOT") return;
        const { snapshot, lastEventId, liquidationCounters, streamId } = message.payload;

        // Extract schemaVersion + checksum from the inner snapshot JSON
        let schemaVersion = 1;
        let checksum = "";
        try {
            const parsed = JSON.parse(snapshot);
            if (typeof parsed.schemaVersion === "number") schemaVersion = parsed.schemaVersion;
            if (typeof parsed.checksum === "string") checksum = parsed.checksum;
        } catch {}

        await prisma.snapshot.create({
            data: {
                snapshot,
                lastEventId: BigInt(lastEventId),
                liquidationCounters: liquidationCounters as Record<string, string>,
                streamId,
                schemaVersion,
                checksum,
            },
        });
        // Prune old snapshots, keep latest 10
        const excess = await prisma.snapshot.findMany({
            orderBy: { createdAt: "desc" },
            skip: 10,
            select: { id: true },
        });
        if (excess.length > 0) {
            await prisma.snapshot.deleteMany({
                where: { id: { in: excess.map((s: { id: string }) => s.id) } },
            });
        }
        console.log("dbPoller: stored snapshot v" + schemaVersion + " at event", lastEventId);
    } catch (error) {
        console.log("error on storing snapshot-", error);
    }
}

async function updateOrder(orderDetails:EngineResponse){
    try {
    if(orderDetails.event === "ORDER_ACCEPTED"){
         const { side,qty, type, marketId,orderId,slippage,price,userId,state} = orderDetails.payload;
            const response = await prisma.order.create({
                data:{
                    side,
                    type,
                    qty:BigInt(qty),
                    price:BigInt(price),
                    marketId,
                    userId,
                    orderId,
                    filled:0n,
                    state
                }
            })
            return;
        }
        if(orderDetails.event === "ORDER_REJECTED"){
            const { side,qty, type, marketId,orderId,slippage,price,userId,state} = orderDetails.payload;
            const response = await prisma.order.create({
                data:{
                    side,
                    type,
                    filled:0n,
                    qty:BigInt(qty),
                    price:BigInt(price),
                    marketId,
                    userId,
                    orderId,
                    state:"CLOSED"
                }
            })
            return;
        }
        
        if(orderDetails.event === "ORDER_FILLED" || orderDetails.event === "ORDER_FILLED_PARTIALLY"){
            const {orderId,filled,price,matchedOrders,userId,side,type,marketId,qty,tax}= orderDetails.payload;
            const order = await prisma.order.findUnique({where:{orderId}});
            if(!order){
                const response = await prisma.order.create({
                data:{
                    side,
                    type,
                    qty:BigInt(qty),
                    price:BigInt(price),
                    marketId,
                    userId,
                    orderId,
                    filled:BigInt(filled),
                    state:`${BigInt(qty) === BigInt(filled) ? "CLOSED":"FILLED"}`
                }
            })
            }else{
                await prisma.order.update({where:{orderId},
                data:{
                    filled:{increment:BigInt(filled)},
                    state:`${order.qty === order.filled + BigInt(filled) ? "CLOSED" : "FILLED"}`
                }})
                console.log("updated the order")
            }

            for(const matchedOrder of matchedOrders){
                const order = await prisma.order.findUnique({where:{orderId:matchedOrder.orderId}});
                if(!order) throw new Error("order matched on the non existing order");
                
                const updateOrder = await prisma.order.update({
                    where:{orderId:matchedOrder.orderId},
                    data:{
                        filled:{increment:BigInt(matchedOrder.qtyTransfered)},
                        state:`${order.qty=== order.filled+BigInt(matchedOrder.qtyTransfered) ? "CLOSED":"FILLED" }`
                    }
                })
                console.log("updated the order-",updateOrder);
                const response = await prisma.transaction.create({
                    data:{
                        takerId:userId,
                        makerId:matchedOrder.userId,
                        takerFee:BigInt(tax),
                        makerFee:BigInt(matchedOrder.tax),
                        takerOrderId:orderId,
                        makerOrderId:matchedOrder.orderId,
                        qty:BigInt(matchedOrder.qtyTransfered),
                        price:BigInt(matchedOrder.price)
                    },
                    select:{
                        id:true
                    }
                });
                console.log("transaction created:-",{
                        takerId:userId,
                        makerId:matchedOrder.userId,
                        takerFee:BigInt(tax),
                        makerFee:BigInt(matchedOrder.tax),
                        takerOrderId:orderId,
                        makerOrderId:matchedOrder.orderId,
                        qty:BigInt(matchedOrder.qtyTransfered),
                        price:BigInt(matchedOrder.price)
                    });
            }

            // Update lastPrice for the market
            try {
                await prisma.market.update({
                    where: { id: marketId },
                    data: { lastPrice: BigInt(price) },
                });
                console.log("dbPoller: updated lastPrice for market", marketId, "to", price);
            } catch (err) {
                console.log("dbPoller: failed to update lastPrice for market", marketId, err);
            }

            return;
        }
    } catch (error) {
        console.log("error occurred on creating the order ",error);
    }
}

async function deleteOrder(orderDetails: { event: string; payload: { success: boolean; orderId: string } }) {
    try {
        const { success, orderId } = orderDetails.payload;
        if(!success) return;
        await prisma.order.update({
            where:{orderId},
            data:{state:"CLOSED"}
        });
        console.log("deleted the order-",orderId);
    } catch (error) {
        console.log("error occurred on deleting the order ",error);
    }
}



