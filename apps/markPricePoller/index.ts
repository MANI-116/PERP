import { WebSocket } from "ws"
import { createClient} from "redis"

const redisUrl = process.env.REDIS_URL ?? undefined;
const sender = createClient(redisUrl ? { url: redisUrl, socket: { tls: true, rejectUnauthorized: false } } : undefined);
sender.on("error",(error)=>{
    console.log(error);
})

await sender.connect();

const URL = process.env.BINANCE_URL;
if(!URL) {console.log("env is not loaded"); process.exit(1);}
const ws = new WebSocket(URL!);

ws.on("open",()=>{
    console.log("connected to binance wss");
})

ws.on("message",(bufferMessage)=>{
    console.log("got the following from binance-",bufferMessage.toString());
    const data = JSON.parse(bufferMessage.toString());
    const { p:markPrice, s:symbol } = data;
    sender.xAdd("engine-stream","*",{type:"UPDATE_MARKPRICE",corelationId:`mp-${Date.now()}`,payload:JSON.stringify({symbol,markPrice})});
    console.log("shared the markPrice with the engine-",symbol,markPrice);
})

ws.on("close",()=>{
    console.log("binance ws closed, reconnecting in 5s...");
    setTimeout(() => process.exit(1), 5000); // let docker/process-manager restart
})

ws.on("error",(error)=>{
    console.log("binance ws error-",error);
})