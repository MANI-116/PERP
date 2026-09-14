"use client";

import { useEffect, useState } from "react";

import {
  BINANCE_REST_BASE,
  MARK_PRICE_POLL_INTERVAL_MS,
} from "@/lib/config";
import { scaleDivisor } from "@/lib/format";

/**
 * Poll the free Binance USDT-M futures mark price for a symbol.
 *
 * Returns the mark price as a scaled integer string so it can be
 * rendered with the existing `formatScaled(value, scale)` helper,
 * or `null` while loading / when Binance cannot be reached.
 *
 * The hook never throws: on any failure it keeps the last known
 * value (or `null`) so callers can fall back to their own source.
 */
export function useMarkPrice(
  symbol: string,
  scale: string | number,
): string | null {
  const [markPrice, setMarkPrice] =
    useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(
          `${BINANCE_REST_BASE}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          throw new Error(
            `mark price request failed: ${res.status}`,
          );
        }

        const data = await res.json();
        const raw = data?.markPrice;

        if (cancelled) return;

        if (
          typeof raw !== "string" &&
          typeof raw !== "number"
        ) {
          throw new Error(
            "mark price response missing markPrice",
          );
        }

        const scaled = Math.round(
          Number(raw) * scaleDivisor(scale),
        );

        if (!Number.isFinite(scaled)) {
          throw new Error(
            "mark price is not a finite number",
          );
        }

        setMarkPrice(String(scaled));
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        console.error(
          "useMarkPrice:",
          symbol,
          error,
        );
      } finally {
        if (!cancelled) {
          timer = setTimeout(
            poll,
            MARK_PRICE_POLL_INTERVAL_MS,
          );
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      controller.abort();

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [symbol, scale]);

  return markPrice;
}
