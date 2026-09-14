import {
  Update,
  OrderBookUpdate,
  TradeTick,
  MarketUpdate,
  WsEnvelope,
} from "@/types";
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
  private socket:WebSocket | null = null;
  private waitTillOpen:Promise<void> = Promise.resolve();
  private resolveOpen:(() => void) | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer:ReturnType<typeof setTimeout> | null = null;
  private reconnectListeners = new Set<() => void>();
  private static instance:null | Socket;

  private constructor(){
    this.dispatcher = EventBus.getInstance();
    this.connect();
  }

  static getInstance(){
    if(this.instance){
      return this.instance
    }

    this.instance = new Socket();

    return this.instance;
  }

  private connect(){
    this.socket = new WebSocket(WS_URL);

    // Fresh promise for this connection attempt.
    this.waitTillOpen = new Promise<void>((resolve)=>{
      this.resolveOpen = resolve;
    });

    this.socket.addEventListener("open", ()=>{
      console.log("[socket] connected");
      this.reconnectAttempts = 0;
      this.resolveOpen?.();
      this.resolveOpen = null;

      // Tell subscribers to re-establish their subscriptions.
      for(const listener of this.reconnectListeners){
        listener();
      }
    });

    this.socket.addEventListener("message", this.messageHandler.bind(this));

    this.socket.addEventListener("close", ()=>{
      console.log("[socket] closed");
      this.scheduleReconnect();
    });

    this.socket.addEventListener("error", (event)=>{
      console.log("[socket] error", event);
    });
  }

  private scheduleReconnect(){
    if(this.reconnectTimer !== null){
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
    this.reconnectAttempts += 1;

    console.log(`[socket] reconnecting in ${delay}ms`);

    this.reconnectTimer = setTimeout(()=>{
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  onReconnect(listener:() => void){
    this.reconnectListeners.add(listener);

    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  messageHandler(message:MessageEvent){
    this.dispatcher.dispatchEvent(message);
  }

  async send(message:any){
    await this.waitTillOpen;

    if(this.socket && this.socket.readyState === WebSocket.OPEN){
      this.socket.send(message);
    }else{
      console.log("[socket] dropping message, socket not open");
    }
  }

}



/**
 * Event Bus
 * Responsibility:
 * route the messages to respective hadlers
 * -allow to register for particular message type
 */

export class EventBus{
  private eventMap = new Map<string, Set<(data: any) => void>>();
  private static instance:EventBus | null
  private constructor(){
    this.eventMap = new Map<string,Set<(update:Update)=>void>>();

  }

  static getInstance(){
    if(this.instance){
      return this.instance;

    }

    this.instance = new EventBus();
    return this.instance;
  }


register(type: string, handler: (data: any) => void) {
  let handlers = this.eventMap.get(type);
  console.log("registering the ws handler:",type," --->handler:",type);

  if (!handlers) {
    handlers = new Set();
    this.eventMap.set(type, handlers);
  }

  handlers.add(handler);
}

unregister(type: string, handler: (data: any) => void) {
  console.log("unregistering the handler:",type," handler:",handler);
  this.eventMap.get(type)?.delete(handler);
}

  dispatchEvent(event: MessageEvent) {
    let envelope: WsEnvelope;

    try {
      envelope = JSON.parse(
        event.data,
      ) as WsEnvelope;
    } catch (error) {
      console.error(
        "[eventBus] failed to parse ws message",
        error,
      );

      return;
    }

    const handlers = this.eventMap.get(
      envelope.type,
    );

    if (!handlers) return;

    for (const handler of handlers) {
      handler(envelope.data);
    }
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


export type MarketEvent = "book" | "candle" | "ticker";

export interface Ticker {
  [key: string]: unknown;
}

type Handler<T> = (data: T) => void;

interface MarketSubscribers {
  book: Set<Handler<OrderBookUpdate>>;
  candle: Set<Handler<TradeTick>>;
  ticker: Set<Handler<Ticker>>;
}

export class MarketManager {
  private static instance: MarketManager | null = null;

  private readonly socket: Socket;
  private readonly eventBus: EventBus;

  /**
   * marketId
   *    ↓
   * subscribers
   *    ├── book
   *    ├── candle
   *    └── ticker
   */
  private readonly markets =
    new Map<string, MarketSubscribers>();

  /**
   * Tracks the actual exchange-level subscription.
   *
   * One market = one websocket subscription.
   */
  private readonly subscribedMarkets =
    new Set<string>();

  private constructor() {
    this.socket = Socket.getInstance();
    this.eventBus = EventBus.getInstance();

    /**
     * EventBus only knows about websocket message types.
     *
     * It doesn't know about book/candle/ticker.
     */
    this.eventBus.register(
      "update",
      this.handleUpdate
    );

    /**
     * Re-establish every subscription after a
     * websocket reconnect.
     */
    this.socket.onReconnect(() => {
      for (const marketId of this.subscribedMarkets) {
        void this.socket.send(
          JSON.stringify({ type: "subscribe", marketId }),
        );
      }
    });
  }

  static getInstance(): MarketManager {
    if (!MarketManager.instance) {
      MarketManager.instance =
        new MarketManager();
    }

    return MarketManager.instance;
  }

  // ==================================================
  // PUBLIC SUBSCRIPTION API
  // ==================================================

  subscribe<T>(
    marketId: string,
    event: MarketEvent,
    handler: Handler<T>,
  ): () => void {
    const market =
      this.getOrCreateMarket(marketId);

    const handlers =
      market[event] as Set<Handler<T>>;

    handlers.add(handler);

    /**
     * First consumer for this market causes
     * the actual websocket subscription.
     */
    if (!this.subscribedMarkets.has(marketId)) {
      void this.subscribeMarket(marketId);
    }

    /**
     * Returning cleanup is ideal for React.
     */
    return () => {
      this.unsubscribe(
        marketId,
        event,
        handler,
      );
    };
  }

  unsubscribe<T>(
    marketId: string,
    event: MarketEvent,
    handler: Handler<T>,
  ): void {
    const market =
      this.markets.get(marketId);

    if (!market) return;

    const handlers =
      market[event] as Set<Handler<T>>;

    handlers.delete(handler);

    /**
     * Other consumers are still using this market.
     */
    if (!this.hasSubscribers(market)) {
      this.markets.delete(marketId);

      void this.unsubscribeMarket(marketId);
    }
  }

  // ==================================================
  // EVENTBUS → MARKETMANAGER
  // ==================================================

  private handleUpdate = (
    data: MarketUpdate,
  ): void => {

    console.log("[marketManager] handler update:",data);
    const market =
      this.markets.get(data.marketId);

    if (!market) return;

    /**
     * The websocket message may contain
     * any combination of book/candle/ticker.
     */

    if (data.book !== undefined) {
      this.dispatch(
        market.book,
        data.book,
      );
    }

    if (data.candles !== undefined) {
      this.dispatch(
        market.candle,
        data.candles,
      );
    }

    if (data.ticker !== undefined) {
      this.dispatch(
        market.ticker,
        data.ticker,
      );
    }
  };

  private dispatch<T>(
    handlers: Set<Handler<T>>,
    data: T,
  ): void {
    for (const handler of handlers) {
      handler(data);
    }
  }

  // ==================================================
  // MARKET STORAGE
  // ==================================================

  private getOrCreateMarket(
    marketId: string,
  ): MarketSubscribers {
    let market =
      this.markets.get(marketId);

    if (!market) {
      market = {
        book: new Set(),
        candle: new Set(),
        ticker: new Set(),
      };

      this.markets.set(
        marketId,
        market,
      );
    }

    return market;
  }

  private hasSubscribers(
    market: MarketSubscribers,
  ): boolean {
    return (
      market.book.size > 0 ||
      market.candle.size > 0 ||
      market.ticker.size > 0
    );
  }

  // ==================================================
  // WEBSOCKET LIFECYCLE
  // ==================================================

  private async subscribeMarket(
    marketId: string,
  ): Promise<void> {
    /**
     * Race protection.
     */
    if (
      this.subscribedMarkets.has(marketId)
    ) {
      return;
    }

    // Mark intent before sending so a reconnect can
    // re-subscribe even if this first send is dropped.
    this.subscribedMarkets.add(marketId);

    console.log("[market-manager]:sending message for the market sub-",marketId);

    await this.socket.send(
      JSON.stringify({
        type: "subscribe",
        marketId:marketId,
      }),
    );
  }

  private async unsubscribeMarket(
    marketId: string,
  ): Promise<void> {
    if (
      !this.subscribedMarkets.has(marketId)
    ) {
      return;
    }

    await this.socket.send(
      JSON.stringify({
        type: "unsubscribe",
        marketId,
      }),
    );

    this.subscribedMarkets.delete(
      marketId,
    );
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
  public askLevelsData:Map<number,number>;
  public bidLevelsData:Map<number,number>;
  public totalAsks:number
  public totalBids:number
  public snapshotUid:number

  constructor(){
    this.askLevels = [];
    this.bidLevels = [];
    this.askLevelsData = new Map<number,number>();
    this.bidLevelsData = new Map<number,number>();
    this.totalAsks=0;
    this.totalBids=0;
    this.snapshotUid=0;

  }

  setUid(uid:number){
    this.snapshotUid = uid;
  }
  addAskLevel(price:number,totalQuantity:number){
      console.log('add asklevel-',price,":",totalQuantity);
      const levels = this.askLevelsData   
      
              const quantity =  levels.get(price);
              if(quantity === undefined){
                // no level — skip if qty is 0 (no-op create)
                if(totalQuantity === 0) return;
                levels.set(price,totalQuantity);
                 this.askLevels.push(price);
                 this.askLevels.sort((a,b)=>a-b);
                  this.totalAsks += totalQuantity;
                
                const length = this.askLevels.length;
                if(length > 20){
                    const lastLevel = this.askLevels[length-1];

                    const qty =  levels.get(lastLevel);
                       this.totalAsks -= qty!;
                

                    levels.delete(lastLevel);
                    this.askLevels.pop();
                    this.askLevels.sort((a,b)=>a-b);
                


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
      
              const levels = this.bidLevelsData
            
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

            for(let i=0; i<update.bids.length; i++) {
              if (update.bids[i].length > 0) {
                const price = Number(update.bids[i][0]);
                const totalQuantity = Number(update.bids[i][1]); 
                this.addBidLevel(price,totalQuantity);
              }
            } 
            for(let i=0; i<update.asks.length; i++) {
              if (update.asks[i].length > 0) {
                const price = Number(update.asks[i][0]);
                const totalQuantity = Number(update.asks[i][1]);
                this.addAskLevel(price,totalQuantity);  
              }
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
  clone.askLevelsData = new Map(book.askLevelsData);
  clone.bidLevelsData = new Map(book.bidLevelsData);
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


export class OrderbookStore {
  private updates: Queue<Update>;
  private snapshot: OrderBook;
  private snapshotAvailable = false;
  private updateHandler: (update: Update) => void;
  private unsubscribeMarket: (() => void) | null = null;

  private constructor(
    private marketId: string,
    private render: (orderbook: OrderBook) => void,
  ) {
    this.updates = new Queue<Update>();
    this.snapshot = new OrderBook();

    // IMPORTANT: keep the exact same function reference
    // for subscribe and unsubscribe.
    this.updateHandler = this.applyUpdate.bind(this);
  }

  static async getOrderBook(
    marketId: string,
    render: (orderbook: OrderBook) => void,
  ) {
    const store = new OrderbookStore(marketId, render);

    const marketManager = MarketManager.getInstance();

      store.unsubscribeMarket = marketManager.subscribe(
    marketId,
    "book",
    store.updateHandler,
  );

    // Fetch snapshot. If it fails, release the subscription
    // so we don't leak a websocket listener.
    try {
      await store.setSnapshot();
    } catch (error) {
      store.unsubscribe();
      throw error;
    }

    store.render(cloneOrderBook(store.snapshot));

    // Apply updates received while snapshot was loading.
    while (!store.updates.isEmpty()) {
      const update = store.updates.dequeue();

      if (!update) break;

      if (update.uid < store.snapshot.snapshotUid) {
        continue;
      }

      store.snapshot.update(update);
    }

    store.snapshotAvailable = true;

    store.render(cloneOrderBook(store.snapshot));

    // IMPORTANT: return the store so the hook can unsubscribe.
    return store;
  }

  async setSnapshot() {
    try {
      const res = await fetch(
        `${API_BASE}/depth/${this.marketId}`,
        {
          credentials: "include",
        },
      );

      const data = await res.json();

      const depth = data?.data;

      if (!depth?.asks && !depth?.bids) {
        console.log("depth snapshot format not matched");
        return;
      }

      if (depth.asks instanceof Array) {
        for (const level of depth.asks) {
          this.snapshot.addAskLevel(
            Number(level[0]),
            Number(level[1]),
          );
        }
      }

      if (depth.bids instanceof Array) {
        for (const level of depth.bids) {
          this.snapshot.addBidLevel(
            Number(level[0]),
            Number(level[1]),
          );
        }
      }

      this.snapshot.snapshotUid =
        depth.uidAtSnapshot;

    } catch (error) {
      console.log(
        "error happened while fetching the depth-",
        error,
      );

      throw error;
    }
  }

  applyUpdate(update: Update) {
    console.log("updating snapshot-");

    if (this.snapshotAvailable) {
      const res = this.snapshot.update(update);

      console.log(
        "updating existing snap:",
        res,
      );
    } else {
      console.log("pushing to the queue");

      this.updates.enqueue(update);
    }

    this.render(cloneOrderBook(this.snapshot));
  }


unsubscribe(): void {
  if (!this.unsubscribeMarket) {
    return;
  }

  this.unsubscribeMarket();
  this.unsubscribeMarket = null;
}
}
