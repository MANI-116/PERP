import { createClient} from "redis"
import { WebSocket, WebSocketServer } from "ws"
import http from "http"
import { type EngineResponse, type RedisResponse} from "@repo/types"
import { prisma } from "@repo/db"

const redisUrl = process.env.REDIS_URL ?? undefined;
const receiver = createClient(redisUrl ? { url: redisUrl } : undefined);
receiver.on("error",(error)=>{
    console.log("error on connceting to the receiver-",error);
})

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

server.listen(8080,()=>{
    console.log("ws server is listening from the port:",8080)
})

function handleUnsubscribe(marketId:string,ws:WebSocket){
     const set = subscribers.get(marketId);
     if(!set){
        return ws.send(JSON.stringify({type:"unSubscribeStatus",data:{success:true,message:"subscribed successfully but no market found "}}))    
     }else{
        set.delete(ws);
        return ws.send(JSON.stringify({type:"unSubscribeStatus",data:{success:true,message:"subscribed successfully "}}))
     }
}

wss.on("connection",(ws,request)=>{

    ws.on("message",(buffer)=>{
        const data = JSON.parse(buffer.toString());
        console.log("got the message-",data);
        if(data.type === "subscribe"){
            console.log("message to subscribe-",data);
            const marketId = data.marketId;
            const set = subscribers.get(marketId);
            if(!set){
                const mid = marketUpdates.get(marketId);
                console.log("marketId-",mid);
                if(mid != undefined){
                    const set = new Set<WebSocket>();
                    set.add(ws);
                    subscribers.set(marketId,set);
                    return ws.send(JSON.stringify({type:"subscribeStatus",data:{success:true,message:"subscribed successfully "}}))
                }
                return ws.send(JSON.stringify({type:"subscribeStatus",data:{success:false,message:"market does not found"}}));
            }
            if(set.has(ws)){
                return ws.send(JSON.stringify({type:"subscribeStatus",data:{success:true,messageg:"already subscribed"}}))
            }
            set.add(ws);
            return ws.send(JSON.stringify({type:"subscribeStatus",data:{success:true}}));
        }else if(data.type==="unsubscribe"){
            const marketId=data.marketId;
            handleUnsubscribe(marketId,ws)
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
   await receiver.xGroupCreate("response-stream","websocketserver","$",{MKSTREAM:true});
} catch (error) {
    console.log("error on creating the websocketserver",error)
}

while(true){
    console.log("-- waiting for the engine events --")
    const response :RedisResponse[] |null= await receiver.xReadGroup("websocketserver","ws-1",[{key:"response-stream",id:">"}],{BLOCK:10000}) as RedisResponse[] |null;
    if(response === null) continue;

    console.log("got the response from the stream",response);
    const stream = response[0];
    if(stream === undefined) continue;
    const {messages:streamMessages} =stream;
    
    for(const streamMsg of streamMessages){
        console.log("stream message-",streamMsg)
        const {id} = streamMsg;

        const parsed = JSON.parse(streamMsg.message.message!) as EngineResponse;
        const {event, payload, eventId} = parsed;
        console.log("event-",event);

        // Event ID idempotency guard — skip already-processed events
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
        if( !allowedEvents.includes(event) ){
            await receiver.xAck("response-stream","websocketserver",id);
            continue;
        }

        const message = payload
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
        
        if(!subs) {
            console.log("invalid marketId - ",marketId);
            await receiver.xAck("response-stream","websocketserver",id);
            continue;
        }

        for(const subscriber of subs){
            console.log('sending messages to the subsriber')
            //@ts-ignore
            await subscriber.send(JSON.stringify({type:"update",data:message.updates}));
        }
    
        await receiver.xAck("response-stream","websocketserver",id);
    }  
}
