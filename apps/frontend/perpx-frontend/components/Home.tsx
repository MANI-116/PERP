"use client"
import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";
import { MarketDisplay, Ticker } from "@/types";
import {
  formatPercent,
  formatScaledVolume,
  ENGINE_PRICE_SCALE,
} from "@/lib/format";
import { TICKER_POLL_INTERVAL_MS } from "@/hooks/useTicker";


const logos: Record<string, string> = {
  "BTC-PERP": "/coins/btc.png",
  "ETH-PERP": "/coins/eth.png",
  "SOL-PERP": "/coins/sol.png",
  "XRP-PERP": "/coins/xrp.png",
  "DOGE-PERP": "/coins/doge.png",
  "BNB-PERP": "/coins/bnb.png",
};

type Status = "loading" | "ready" | "error";

/** Adaptive precision so sub-$1 assets don't round to "0.00". */
function formatPrice(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const abs = Math.abs(value);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;

  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function TableSkeleton() {
  return (
    <div className="space-y-3 pt-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-6 w-6 animate-pulse rounded-full bg-zinc-800" />
          <div className="h-3 flex-[2] animate-pulse rounded bg-zinc-800" />
          <div className="h-3 flex-1 animate-pulse rounded bg-zinc-800" />
          <div className="h-3 flex-1 animate-pulse rounded bg-zinc-800" />
          <div className="h-3 flex-1 animate-pulse rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
        >
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-800" />
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

function StateMessage({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-zinc-500">{message}</div>
  );
}

export default  function Home() {
  const router = useRouter();
  const [markets, setMarkets] = useState<MarketDisplay[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    function fetchTickers() {
      fetch(`${API_BASE}/tickers`)
        .then((r) => {
          if (!r.ok) {
            throw new Error(`tickers request failed: ${r.status}`);
          }
          return r.json();
        })
        .then((data) => {
          const parsed: MarketDisplay[] = (data.tickers ?? []).map((t: Ticker) => {
            return {
              symbol: t.symbol,
              name: t.name,
              logo:
                logos[t.name] ??
                logos[t.symbol] ??
                "/coins/btc.png",
              price: Number(t.lastPrice) / ENGINE_PRICE_SCALE,
              volume24h: formatScaledVolume(t.volume24h, 1),
              openInterest: formatScaledVolume(t.openInterest, 1),
              change24h: t.change24h,
            };
          });
          setMarkets(parsed);
          setStatus("ready");
        })
        .catch((err) => {
          console.error("markets: failed to load tickers", err);
          setStatus((prev) => (prev === "ready" ? "ready" : "error"));
        });
    }
    fetchTickers();
    const interval = setInterval(
      fetchTickers,
      TICKER_POLL_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, []);

  const hasMarkets = markets.length > 0;

  return (
      <main>
        <div className="bg-zinc-900 rounded-xl p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Futures</h2>
            <span className="text-[13px] text-zinc-500">
              {markets.length > 0 ? `${markets.length} markets` : ""}
            </span>
          </div>

          {/* =====================================================
              DESKTOP / TABLET — table
          ====================================================== */}
          <div className="hidden md:block">
            <div className="flex flex-row items-center border-b border-zinc-800 gap-x-1 pb-3 text-zinc-500 text-[13px] font-medium uppercase tracking-wider">
              <div className="flex-[2]"><h3>Name</h3></div>
              <div className="flex-1"><h3>Price</h3></div>
              <div className="flex-1"><h3>24h Volume</h3></div>
              <div className="flex-1"><h3>Open Interest</h3></div>
              <div className="flex-1"><h3>24h Change</h3></div>
            </div>

            {!hasMarkets && status === "loading" && <TableSkeleton />}

            {!hasMarkets && status === "error" && (
              <StateMessage message="Couldn't load markets. Retrying..." />
            )}

            {!hasMarkets && status === "ready" && (
              <StateMessage message="No markets available" />
            )}

            {markets.map((m) => (
              <div
                key={m.symbol}
                onClick={() => router.push(`/trade/${m.symbol}`)}
                className="flex flex-row items-center p-2.5 border-b border-zinc-800 gap-x-1 cursor-pointer transition-colors hover:bg-zinc-800/50 rounded"
              >
                <div className="flex-[2]">
                  <div className="flex flex-row items-center gap-x-2">
                    <Image src={m.logo} width={24} height={24} className="rounded-full" alt="" />
                    <span className="text-sm font-medium text-zinc-200">{m.name}</span>
                  </div>
                </div>
                <div className="flex-1 text-sm tabular-nums text-zinc-200">{formatPrice(m.price)}</div>
                <div className="flex-1 text-sm text-zinc-500">{m.volume24h}</div>
                <div className="flex-1 text-sm text-zinc-500">{m.openInterest}</div>
                <div className={`flex-1 text-sm tabular-nums ${m.change24h < 0 ? "text-[#f23645]" : "text-[#0ecb81]"}`}>
                  <span>{formatPercent(m.change24h)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* =====================================================
              MOBILE — cards
          ====================================================== */}
          <div className="space-y-2 md:hidden">
            {!hasMarkets && status === "loading" && <CardSkeleton />}

            {!hasMarkets && status === "error" && (
              <StateMessage message="Couldn't load markets. Retrying..." />
            )}

            {!hasMarkets && status === "ready" && (
              <StateMessage message="No markets available" />
            )}

            {markets.map((m) => (
              <div
                key={m.symbol}
                onClick={() => router.push(`/trade/${m.symbol}`)}
                className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 transition-colors active:bg-zinc-800/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Image src={m.logo} width={28} height={28} className="rounded-full" alt="" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-200">{m.name}</div>
                      <div className="truncate text-[13px] text-zinc-500">{m.symbol}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium tabular-nums text-zinc-200">
                      {formatPrice(m.price)}
                    </div>
                    <div className={`text-[13px] tabular-nums ${m.change24h < 0 ? "text-[#f23645]" : "text-[#0ecb81]"}`}>
                      {formatPercent(m.change24h)}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-zinc-800/70 pt-2 text-[13px] text-zinc-500">
                  <span>24h Vol <span className="text-zinc-300">{m.volume24h}</span></span>
                  <span>OI <span className="text-zinc-300">{m.openInterest}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
  
  );
}
