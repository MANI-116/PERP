import { OrderBook, OrderbookStore, MarketManager } from "@/lib/socketManager";
import { useState, useEffect } from "react";

interface UseOrderbookReturn{
  state:"loading" | "loaded" | "error",
  orderbook:OrderBook | null,
  error:boolean
}
export function useOrderBook(marketId: string) {
  const [snapshot, setSnapshot] = useState<UseOrderbookReturn>({
    state: "loading",
    orderbook: null,
    error: false
  });

  useEffect(() => {
    (async function () {

      await OrderbookStore.getOrderBook(marketId, (b: OrderBook) => setSnapshot({state:"loaded",orderbook:b,error:false}));
    })();

    return () => {
      (async function cleanup(){
        await MarketManager.getInstance().unsubsribe(marketId);
      })();
    };
  }, [marketId]);

  return snapshot ;
}