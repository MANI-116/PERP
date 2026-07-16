import { WebSocket } from "ws";
export function handleUnsubscribe(marketId:string,ws:WebSocket,subscribers:Map<string,Set<WebSocket>>){
     const set = subscribers.get(marketId);
     if(!set){
        return ws.send(JSON.stringify({type:"unSubscribeStatus",data:{success:true,message:"subscribed successfully but no market found "}}))    
     }else{
        set.delete(ws);
        return ws.send(JSON.stringify({type:"unSubscribeStatus",data:{success:true,message:"subscribed successfully "}}))
     }
}

export function handleSubscribe(marketId:string,ws:WebSocket,subscribers:Map<string,Set<WebSocket>>,marketUpdates:Map<string,number>){

            
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

}