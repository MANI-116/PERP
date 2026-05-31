import { createClient} from "redis"
import { WebSocketServer, type WebSocket } from "ws"
import http from "http"
import { type RedisResponse} from "@repo/types"

const receiver = createClient();
receiver.on("error",(error)=>{
    console.log("error on connceting to the receiver-",error);
})

await receiver.connect();

const server = http.createServer();

const wss= new WebSocketServer({server});

const subscribers = new Map<string,WebSocket>()

wss.on("connection",(ws,request)=>{

    ws.on("message",(buffer)=>{
        const data = JSON.parse(buffer.toString());
        if(data.type === "subscribe"){
            subscribers.set(data.userId,ws);
            ws.send(JSON.stringify({type:"subscribeStatus",data:{success:true}}));
        }

    })

    ws.on("close",()=>{
        for(const [subscriber,socket] of subscribers){
            if(socket === ws){
                subscribers.delete(subscriber);
                break;
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
    console.log("waiting for the response--")
    const response :RedisResponse[] |null= await receiver.xReadGroup("websocketserver","ws-1",[{key:"response-stream",id:">"}],{BLOCK:10000}) as RedisResponse[] |null;
    if(response === null) continue;
    console.log("got the response fro the stream",response);
    const stream = response[0];
    if(stream === undefined) continue;
    const {messages:streamMessages} =stream;
    
    for(const streamMsg of streamMessages){
        const {id,message} = streamMsg;
        console.log("message from the response-stream-",message);
        subscribers.values().forEach((socket)=>{
        
            if(socket.readyState === socket.OPEN){
                socket.send(JSON.stringify({data:message.update,type:"Update"}));
            }
        });

        await receiver.xAck("response-stream","websocketserver",id);

    }
  
  

}