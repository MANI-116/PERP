import { createClient} from "redis"
import { WebSocket, WebSocketServer } from "ws"
import http from "http"
import { type EngineResponse, type RedisResponse} from "@repo/types"
import { prisma } from "./lib/db.js"
import { handleSubscribe, handleUnsubscribe } from "./handlers/index.js"
import { config } from "./config.js"
const redisUrl = config.REDIS_URL;


const receiver = (config.ENVIRONMENT === "local" || config.ENVIRONMENT === "development") ? createClient({ url: redisUrl }):createClient({ url: redisUrl, socket: {tls:true, rejectUnauthorized:false}  });


await receiver.connect();

const server = http.createServer();

const wss= new WebSocketServer({server});

const subscribers = new Map<string,Set<WebSocket>>();
const marketUpdates = new Map<string,number>();
let lastProcessedEventId = 0n;

async function initializeServer(){
    try {
        const markets = await prisma.market.findMany({
            select:{id:true},
        })
        console.log("markets-",markets);
        markets.forEach((m)=>{
            marketUpdates.set(m.id,0);
        })
    } catch (error) {
        console.log("ERROR WHILE FETCHING THE MARKETS-",error);
    }
}

await initializeServer();

server.listen(config.PORT, "0.0.0.0", () => {
    console.log(
        "ws server is listening from the port:",
        config.PORT
    );
});

wss.on("connection",(ws,request)=>{

    ws.on("message",(buffer)=>{

        const data = JSON.parse(buffer.toString());
    
        if(data.type === "subscribe"){
            console.log("message to subscribe-",data);
            const marketId = data.marketId;
            handleSubscribe(marketId,ws,subscribers,marketUpdates);

        }else if(data.type==="unsubscribe"){
            const marketId=data.marketId;
            handleUnsubscribe(marketId,ws,subscribers);
        }
    })

    ws.on("close",()=>{
        for(const [subscriber,set] of subscribers){
          if(set.has(ws)){
            set.delete(ws);
            return ws.send(JSON.stringify({type:"close",data:{status:true,message:"deleted successfully"}}))
          }
        }
    })
})



try {
   await receiver.xGroupCreate("response-stream",
    "websocketserver",
    "$",
    {MKSTREAM:true});
} catch (error) {

   if (
      error instanceof Error &&
      error.message.includes("BUSYGROUP")
    ) {
      console.log( `consumer group wss already exists `);
      
    }else{

      throw new Error(
        `Failed to create consumer group wss : ${String(
          error,
        )}`,
      );
    }
    
}


//non-blocking loop to read the messages from the response-stream and broadcast to the subscribers
while(true){
    console.log("-- waiting for the engine events --")
    const response :RedisResponse[] |null= await receiver.xReadGroup("websocketserver","ws-1",[{key:"response-stream",id:">"}],{BLOCK:10000}) as RedisResponse[] |null;
    if(response === null) continue;

    console.log("got the response from the stream",response);
    const stream = response[0];
    if(stream === undefined) continue;
    const {messages:streamMessages} =stream;
    
    for(const streamMsg of streamMessages){
      
        const {id} = streamMsg;

        const parsed = streamMsg.message;
        let {event, payload, eventId, timestamp} = parsed;
       
        // Event ID idempotency guard — skip already-processed events
        console.log("[ws]:",parsed);
        if (event !== "SNAPSHOT" && eventId) {
            const evId = BigInt(eventId);
            if (evId <= lastProcessedEventId) {
                console.log("wsServer: skipping duplicate event", event, evId.toString());
                await receiver.xAck("response-stream","websocketserver",id);
                continue;
            }
            lastProcessedEventId = evId;
        }

        const allowedEvents = ["ORDER_ACCEPTED","ORDER_FILLED","ORDER_FILLED_PARTIALLY","DELETE_ORDER"]
        if( !allowedEvents.includes(event!) ){
            await receiver.xAck("response-stream","websocketserver",id);
            continue;
        }

        type candle = {
          price:string,
          qty:string
        }
         let candles :{timestamp:string, candles:candle[]}|null = null;

        if(event === "ORDER_FILLED" || event === "ORDER_FILLED_PARTIALLY"){
          console.log("payload of the order filled or partialluy filled:",payload);
          const orderDetails = JSON.parse(payload as string);
          console.log("order details:",orderDetails);
           const {matchedOrders}= orderDetails;
            candles= { timestamp,
            candles:[]

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

                candles.candles.push({qty:matchedOrder.qtyTransfered, price: matchedOrder.price})
              
            }

        }

         console.log(payload);
        console.log("event-",event,"parsed:",parsed);
        let message = JSON.parse(payload as string);


  
        console.log("message from the response-stream-",message);

        //@ts-ignore
        const marketId = message.marketId;
        if(!marketId) {
            console.log("event missing the marketID");
            await receiver.xAck("response-stream","websocketserver",id);
            continue;
        }

        //@ts-ignore
        if(!message.updates) {
            console.log("no updates in event, skipping broadcast");
            await receiver.xAck("response-stream","websocketserver",id);
            continue;
        }

        const subs = subscribers.get(marketId);
        console.log("subs::::",subs);
        if(!subs) {
            console.log("invalid marketId - ",marketId);
            await receiver.xAck("response-stream","websocketserver",id);
            continue;
        }

        //sending the updates without await so that receiver with bad network does not block the other subscribers
        for(const subscriber of subs){
            console.log('sending messages to the subsriber')
        
            //@ts-ignore
            if(candles != null){

              subscriber.send(JSON.stringify({type:"update",data:{marketId,book:message.updates,candles}}));
            }else{
              subscriber.send(JSON.stringify({type:"update",data:{marketId,book:message.updates}}));
            }
        }
    
        await receiver.xAck("response-stream","websocketserver",id);
    }  
}
