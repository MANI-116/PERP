import { Update } from "@/types";
import { API_BASE, WS_URL } from "./config";
import { Queue } from "./queue";


/**
 * Responsibility:
 *  maintain socket connections
 *  -connect return only after the connection is established
 *  -send  send messages only after connection is established
 *  -receive 
 *  -disconnect
 */

export class Socket{
  private dispatcher:EventBus;
  private socket:WebSocket;
  private waitTillOpen:Promise<void>;
  private static instance:null | Socket;
  
  private constructor(){
    this.dispatcher = EventBus.getInstance();
    this.socket = new WebSocket(WS_URL);

    //ready state promise
    this.waitTillOpen = new Promise<void>((res,_)=>{
      this.socket.onopen = ((e)=>{ 
        console.log("ws connected")
        res() })

    });

    //add onmessage hanlder
    this.socket.addEventListener("message",this.messageHandler.bind(this))

    }

  static getInstance(){
    if(this.instance){
      return this.instance
    }

    this.instance = new Socket();

    return this.instance;
  }

   messageHandler(message:MessageEvent){
    this.dispatcher.dispatchEvent(message);
    return;

  }

  async send(message:any){
    await this.waitTillOpen;
    await this.socket.send(message);
  }

}



/**
 * Event Bus
 * Responsibility:
 * route the messages to respective hadlers
 * -allow to register for particular message type
 */

export class EventBus{
  private eventMap:Map<string,(update:Update)=>void>;
  private static instance:EventBus | null
  private constructor(){
    this.eventMap = new Map<string,(update:Update)=>void>();

  }

  static getInstance(){
    if(this.instance){
      return this.instance;

    }

    this.instance = new EventBus();
    return this.instance;
  }

  register(messageType:string,handler:(update:Update)=>void){
    console.log("register-event:",messageType);
    this.eventMap.set(messageType,handler);

  }
  dispatchEvent(event:MessageEvent){
    const data = JSON.parse(event.data) ;
    const { type } = data;
    if(!type){
      console.log("type doesnot defined");
      return;
    }
    const handler = this.eventMap.get(type);
    if(!handler){
      console.log("does not find the handler-",handler);
      return;
    }
    console.log("calling handler:")
    handler(data.data);
  }
}





/**
 * Responsibility:
 * maintain orerbookstore connections
 * subscribe : atomic
 *  -send subcribe message and wait til it subscribed
 * --register the dispatcher for the updates from the server
 * 
 */

export class MarketManager{
  private socket:Socket;
  private callbakckResolvers:Map<string,(value:unknown)=>void>;
  private unsubscribeResolvers:Map<string,(value:unknown)=>void>;
  private static instace:null|MarketManager;
  private constructor(){
    this.socket = Socket.getInstance();
    this.callbakckResolvers = new Map<string,(value:unknown)=>void>();
    this.unsubscribeResolvers = new Map<string,(value:unknown)=>void>();

  }

  static getInstance(){
    if(MarketManager.instace){
      return MarketManager.instace;
    }

    MarketManager.instace = new MarketManager();
    return MarketManager.instace;
  }

  

  async subscribe(marketId:string,updateHanler:(update:Update)=>void){
    console.log("subscribing to ws");
    const eventBus = EventBus.getInstance();
    const subscriptionReady =  new Promise((res,_)=>{
      this.callbakckResolvers.set(marketId,res);
    })
    eventBus.register("subscribeStatus",(data)=>{
      const resolver = this.callbakckResolvers.get(marketId);
      if(!resolver){
        console.log("did not find the resolver");
        return;
      }
      resolver(data);
    })
    eventBus.register("update",updateHanler);
    await this.socket.send(JSON.stringify({type:"subscribe",marketId}));
     
    await subscriptionReady;
  

  }

  async unsubsribe(marketId:string){
    console.log("unsubscribing");
    const unsubscribePromise = new Promise((res,_)=>{
      this.unsubscribeResolvers.set(marketId,res);
    })
    EventBus.getInstance().register("unsubscribeStatus",(data)=>{
      const res = this.unsubscribeResolvers.get(marketId)!;
      res(data);
    })
    await this.socket.send(JSON.stringify({type:"unsubscribe",marketId}));
    const res = await unsubscribePromise;
    console.log("unsubscribe status-",res);
  

  }
}


/**
 * Responsibility:
 *  maintain current state of the orderbook
 *  maintain only top 20 levels of asks and bids
 * 
 * it should does not bother with socket connections and management
 */
export class OrderBook{
  public askLevels:number[]
  public bidLevels:number[]
  public priceLevelsData:Map<number,number>;
  public totalAsks:number
  public totalBids:number
  public snapshotUid:number

  constructor(){
    this.askLevels = [];
    this.bidLevels = [];
    this.priceLevelsData = new Map<number,number>();
    this.totalAsks=0;
    this.totalBids=0;
    this.snapshotUid=0;

  }

  setUid(uid:number){
    this.snapshotUid = uid;
  }
  addAskLevel(price:number,totalQuantity:number){
      console.log('add asklevel-',price,":",totalQuantity);
      const levels = this.priceLevelsData   
      
              const quantity =  levels.get(price);
              if(quantity === undefined){
                // no level — skip if qty is 0 (no-op create)
                if(totalQuantity === 0) return;
                levels.set(price,totalQuantity);
                 this.askLevels.push(price);
                 this.askLevels.sort();
                  this.totalAsks += totalQuantity;
                
                const length = this.askLevels.length;
                if(length > 20){
                    const lastLevel = this.askLevels[length-1];

                    const qty =  levels.get(lastLevel);
                       this.totalAsks -= qty!;
                

                    levels.delete(lastLevel);
                    this.askLevels.pop();
                    this.askLevels.sort();
                


                }
              
            
            }else{
                //update.data the existing the level
                const prevQuantity = levels.get(price)!;
                if(totalQuantity === 0){
                  //level is removed — delete it from both map and sorted array
                  levels.delete(price);
                  this.totalAsks -= prevQuantity;
                  const idx = this.askLevels.indexOf(price);
                  if(idx !== -1) this.askLevels.splice(idx, 1);
                }else{
                  levels.set(price,totalQuantity);
                  this.totalAsks += totalQuantity - prevQuantity;
                }
              
            }
            
  }
  
  addBidLevel(price:number,totalQuantity:number){
              console.log('add bidlevel-',price,":",totalQuantity);
      
              const levels = this.priceLevelsData
            
              const quantity =  levels.get(price);
              if(quantity === undefined){
                // no level — skip if qty is 0 (no-op create)
                if(totalQuantity === 0) return;
                 levels.set(price,totalQuantity);
                 this.bidLevels.push(price);
                 this.bidLevels.sort((a,b)=>b-a);
                 this.totalBids += totalQuantity;
                
                const length =   this.bidLevels.length;
                if(length > 20){
                    const lastLevel =   this.bidLevels[length-1];
                    const qty =  levels.get(lastLevel);
                    this.totalBids -= qty!;

                    levels.delete(lastLevel);
                    this.bidLevels.pop();
                    this.bidLevels.sort((a,b)=>b-a);
                
                } 
            }else{
                //update.data the existing the level
                const prevQuantity = levels.get(price);
                if(totalQuantity === 0){
                  //level is removed — delete it from both map and sorted array
                  levels.delete(price);
                  this.totalBids -= prevQuantity!;
                  const idx = this.bidLevels.indexOf(price);
                  if(idx !== -1) this.bidLevels.splice(idx, 1);
                }else{
                  levels.set(price,totalQuantity);
                  this.totalBids += totalQuantity - prevQuantity!;
                }
              
            }

  }

  update(update:Update){
    
    if(!(update.uid === this.snapshotUid + 1)){
              //update lost ,need to get new snapshot    
              console.log("update lost:");
              return false;
        }
            this.snapshotUid = update.uid;

            if(update.bids.length > 0 && update.bids[0].length > 0){
              const price = Number(update.bids[0][0]);
              const totalQuantity = Number(update.bids[0][1]); 

              if(totalQuantity === 0){
                const prevQuantity = this.priceLevelsData.get(price)!;
                this.totalBids -= prevQuantity;
                //remove level:
                this.priceLevelsData.delete(price);
                //remove level from the bidLevels
                const index = this.bidLevels.findIndex((value)=>value===price);
                this.bidLevels.splice(index,1);

                return false;
              }
              
              this.addBidLevel(price,totalQuantity);
             
            } 
            if(update.asks.length > 0 && update.asks[0].length > 0){
              const price = Number(update.asks[0][0]);
              const totalQuantity = Number(update.asks[0][1]);

              console.log('add asklevel-',price,":",totalQuantity);
              
              if(totalQuantity === 0){
                const prevQuantity = this.priceLevelsData.get(price)!;
                this.totalAsks -= prevQuantity;
                //remove level:
                this.priceLevelsData.delete(price);
                //remove level from the bidLevels
                const index = this.askLevels.findIndex((value)=>value===price);
                this.askLevels.splice(index,1);
              

                return false;
              }
              this.addAskLevel(price,totalQuantity);  
            }
            return true;
  }
  

}

/**
 * Create a shallow-cloned copy of OrderBook with new subscribePromisereferences for arrays/map.
 * This ensures React detects state changes via Object.is().
 */
function cloneOrderBook(book: OrderBook): OrderBook {
  const clone = new OrderBook();
  clone.askLevels = [...book.askLevels];
  clone.bidLevels = [...book.bidLevels];
  clone.priceLevelsData = new Map(book.priceLevelsData);
  clone.totalAsks = book.totalAsks;
  clone.totalBids = book.totalBids;
  clone.snapshotUid = book.snapshotUid;
  return clone;
}

/**
 * Responsiblity:
 * maintain orderbook
 * keep updates 
 * listen to updates and apply
 * 
 * does not manage socket connection
 */

export class OrderbookStore{
  private updates:Queue<Update>
  private snapshot:OrderBook
  private snapshotAvailable:boolean=false;

  
  private constructor(private marketId:string,private render:(orderbook:OrderBook)=>void){
    this.updates = new Queue<Update>();
    this.snapshot = new OrderBook();
  }

  static async getOrderBook(marketId:string,render:(orderbook:OrderBook)=>void){
    const store = new OrderbookStore(marketId,render);

  
    const marketManager = MarketManager.getInstance();

    //wait till subscribed and register the update handler
    await marketManager.subscribe(marketId,store.applyUpdate.bind(store));

    // Fetch snapshot 
    await store.setSnapshot();
    store.render(cloneOrderBook(store.snapshot));

    // Apply any queued pre-snapshot updates
    while(!store.updates.isEmpty()){
      const update = store.updates.dequeue();
      if(!update) break;
      if(update.uid < store.snapshot.snapshotUid) continue;
      store.snapshot.update(update);
    }

    store.snapshotAvailable=true;

    render(cloneOrderBook(store.snapshot));
  }

  async setSnapshot(){
    try {
              const res = await fetch(`${API_BASE}/depth/${this.marketId}`,{credentials:"include"});
              const data = await res.json();
              console.log("data from the get depth-",data);
              //data type {success:boolean,asks:[[level(string),totalQty(string)]],uidAtSnapshot:number}
              if(!data.payload.data.asks && !data.payload.data.bids){
                console.log("data format is not matched:")
                return;
              }
              if( data.payload.data.asks instanceof  Array){
    
                for(let i = 0 ; i < data.payload.data.asks.length ; i++){
                  const level = data.payload.data.asks[i];
                  this.snapshot.addAskLevel(Number(level[0]),Number(level[1]));
                }
    
              }
    
              if(data.payload.data.bids instanceof Array){
                  for(let i = 0 ; i < data.payload.data.bids.length ; i++){
                  const level = data.payload.data.bids[i];
                  this.snapshot.addBidLevel(Number(level[0]),Number(level[1]));                   
                }
              }
              
              this.snapshot.snapshotUid = data.payload.data.uidAtSnapshot;
    
            } catch (error) {
              console.log("error happend while fetching the depth-",error);
              
            }

  }

  applyUpdate(update:Update){
               
    console.log("updating snapshot-")
    if(this.snapshotAvailable){
      //update the snapshot
      const res = this.snapshot.update(update);
      console.log("updating existing snap:",res);
      
    }else{
      //push to the queue
      console.log("pushing to the queue")
      this.updates.enqueue(update);
    }

    this.render(cloneOrderBook(this.snapshot));


  }



  

}
