import {
  useEffect,
  useState,
} from "react";

import {
  CandleStore,
  type Candle,
} from "@/lib/candleStore";
import type { Timeframe } from "@/lib/timeframes";

function upsertByBucket(
  candles: Candle[],
  update: Candle,
): Candle[] {
  const index = candles.findIndex(
    (candle) =>
      candle.timestamp === update.timestamp,
  );

  if (index === -1) {
    return [...candles, update].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
  }

  const next = candles.slice();

  next[index] = update;

  return next;
}

export function useCandles(
  marketId: string,
  timeframe: Timeframe,
) {
  const [candles, setCandles] = useState<
    Candle[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  /**
   * Reset synchronously when the market or the
   * timeframe changes so the chart never shows the
   * previous timeframe's series.
   */
  const requestKey = `${marketId}:${timeframe}`;

  const [activeKey, setActiveKey] =
    useState(requestKey);

  if (activeKey !== requestKey) {
    setActiveKey(requestKey);
    setCandles([]);
    setLoading(true);
  }

  useEffect(() => {
    let mounted = true;
    let store: CandleStore | null = null;

    CandleStore.getCandles(
      marketId,
      timeframe,
      (snapshot) => {
        if (!mounted) return;

        setCandles(snapshot);
        setLoading(false);
      },
      (updated) => {
        if (!mounted) return;

        setCandles((previous) =>
          upsertByBucket(
            previous,
            updated,
          ),
        );
      },
    )
      .then((created) => {
        if (!mounted) {
          created.unsubscribe();

          return;
        }

        store = created;
      })
      .catch((error) => {
        if (!mounted) return;

        console.error(
          "Failed to load candles:",
          error,
        );

        setLoading(false);
      });

    return () => {
      mounted = false;

      store?.unsubscribe();
    };
  }, [marketId, timeframe]);

  return {
    candles,
    loading,
  };
}
