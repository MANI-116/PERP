import { useEffect, useState } from "react";
import {
  OrderBook,
  OrderbookStore,
} from "@/lib/socketManager";

interface UseOrderbookReturn {
  state: "loading" | "loaded" | "error";
  orderbook: OrderBook | null;
  error: boolean;
}

export function useOrderBook(
  marketId: string,
): UseOrderbookReturn {
  const [snapshot, setSnapshot] =
    useState<UseOrderbookReturn>({
      state: "loading",
      orderbook: null,
      error: false,
    });

  useEffect(() => {
    let mounted = true;
    let store: OrderbookStore | null = null;

    const initialize = async () => {
      try {
        const created = await OrderbookStore.getOrderBook(
          marketId,
          (orderbook: OrderBook) => {
            if (!mounted) {
              return;
            }

            setSnapshot({
              state: "loaded",
              orderbook,
              error: false,
            });
          },
        );

        // Component unmounted before the snapshot resolved:
        // release the websocket subscription.
        if (!mounted) {
          created.unsubscribe();
          return;
        }

        store = created;
      } catch (error) {
        if (!mounted) {
          return;
        }

        console.error(
          "Failed to load orderbook:",
          error,
        );

        setSnapshot({
          state: "error",
          orderbook: null,
          error: true,
        });
      }
    };

    void initialize();

    return () => {
      mounted = false;

      if (store) {
        void store.unsubscribe();
      }
    };
  }, [marketId]);

  return snapshot;
}

