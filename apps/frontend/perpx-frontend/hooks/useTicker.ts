"use client";

import {
  useEffect,
  useState,
} from "react";

import { API_BASE } from "@/lib/config";
import type { Ticker } from "@/types";

/**
 * Short-polling interval for ticker data.
 */
export const TICKER_POLL_INTERVAL_MS = 10_000;

export function useTicker(
  marketId: string,
): Ticker | null {
  const [ticker, setTicker] =
    useState<Ticker | null>(null);

  useEffect(() => {
    let inFlight = false;

    const controller = new AbortController();

    function fetchTicker() {
      if (inFlight) {
        return;
      }

      inFlight = true;

      fetch(`${API_BASE}/ticker/${marketId}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(
              `ticker request failed: ${res.status}`,
            );
          }

          return res.json();
        })
        .then((data) => {
          if (data?.ticker) {
            setTicker(data.ticker);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          console.error(
            "Failed to load ticker:",
            error,
          );
        })
        .finally(() => {
          inFlight = false;
        });
    }

    fetchTicker();

    const interval = setInterval(
      fetchTicker,
      TICKER_POLL_INTERVAL_MS,
    );

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [marketId]);

  return ticker;
}
