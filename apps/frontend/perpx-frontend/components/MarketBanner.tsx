"use client";

import { useTicker } from "@/hooks/useTicker";
import { useMarkPrice } from "@/hooks/useMarkPrice";
import {
  formatPercent,
  formatScaled,
  formatScaledVolume,
  ENGINE_PRICE_SCALE,
} from "@/lib/format";
import type { BackendMarket } from "@/types";

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes.filter(Boolean).join(" ");
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="shrink-0">
      <div
        className={cn(
          "text-[13px] tabular-nums text-[#e6e8eb]",
          className,
        )}
      >
        {value}
      </div>

      <div className="mt-0.5 text-[13px] uppercase tracking-wide text-[#8b929b]">
        {label}
      </div>
    </div>
  );
}

export function MarketBanner({
  market,
}: {
  market: BackendMarket;
}) {
  const ticker = useTicker(market.id);

  const liveMarkPrice = useMarkPrice(
    market.symbol,
    market.scale,
  );

  const lastPrice =
    ticker?.lastPrice ??
    market.lastPrice ??
    null;

  const markPrice =
    liveMarkPrice ??
    ticker?.markPrice ??
    market.markPrice;

  const change = ticker?.change24h ?? 0;

  const volume = ticker?.volume24h ?? "0";

  const high = ticker?.high24h ?? null;
  const low = ticker?.low24h ?? null;

  const changeColor =
    change >= 0 ? "text-[#0ecb81]" : "text-[#f23645]";

  return (
    <section className="mx-2 mt-2 overflow-hidden rounded-xl bg-zinc-900">
      {/* =====================================================
          DESKTOP / TABLET — single dense row
      ====================================================== */}
      <div className="hidden h-[68px] items-center px-4 lg:flex">
        {/* Market */}
        <div className="flex min-w-[180px] flex-col justify-center border-r border-[#1d2025] pr-5">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-white">
              {market.symbol}
            </span>

            <span className="text-[13px] font-medium text-[#8b929b]">
              PERP
            </span>
          </div>

          <span className="mt-0.5 text-[13px] text-[#8b929b]">
            Perpetual Futures
          </span>
        </div>

        {/* Last Price */}
        <div className="flex min-w-[150px] flex-col justify-center px-5">
          <span className="text-[18px] font-semibold tabular-nums text-white">
            {formatScaled(
              lastPrice,
              ENGINE_PRICE_SCALE,
            )}
          </span>

          <span className="text-[13px] uppercase tracking-wide text-[#8b929b]">
            Last Price
          </span>
        </div>

        {/* Mark Price */}
        <div className="px-5">
          <div className="text-[13px] tabular-nums text-[#e6e8eb]">
            {formatScaled(
              markPrice,
              market.scale,
            )}
          </div>

          <div className="mt-0.5 text-[13px] uppercase text-[#8b929b]">
            Mark Price
          </div>
        </div>

        {/* 24H Change */}
        <div className="px-5">
          <div
            className={cn(
              "text-[13px] tabular-nums",
              changeColor,
            )}
          >
            {formatPercent(change)}
          </div>

          <div className="mt-0.5 text-[13px] uppercase text-[#8b929b]">
            24H Change
          </div>
        </div>

        {/* 24H Volume */}
        <div className="px-5">
          <div className="text-[13px] tabular-nums text-[#e6e8eb]">
            {formatScaledVolume(
              volume,
              1,
            )}
          </div>

          <div className="mt-0.5 text-[13px] uppercase text-[#8b929b]">
            24H Volume
          </div>
        </div>

        {/* 24H High / Low */}
        <div className="px-5">
          <div className="text-[13px] tabular-nums text-[#e6e8eb]">
            {formatScaled(
              high,
              ENGINE_PRICE_SCALE,
            )}{" "}
            /{" "}
            {formatScaled(
              low,
              ENGINE_PRICE_SCALE,
            )}
          </div>

          <div className="mt-0.5 text-[13px] uppercase text-[#8b929b]">
            24H High / Low
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Max Leverage */}
        <div className="flex items-center gap-2 border-l border-[#1d2025] pl-5">
          <span className="text-[13px] uppercase text-[#8b929b]">
            Max
          </span>

          <span className="text-[13px] font-medium text-white">
            10x
          </span>
        </div>
      </div>

      {/* =====================================================
          MOBILE — compact header + scrollable stats
      ====================================================== */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3 px-3 pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-semibold tracking-tight text-white">
              {market.symbol}
            </span>

            <span className="shrink-0 text-[13px] font-medium text-[#8b929b]">
              PERP
            </span>
          </div>

          <div className="text-right">
            <div className="text-[17px] font-semibold tabular-nums text-white">
              {formatScaled(
                lastPrice,
                ENGINE_PRICE_SCALE,
              )}
            </div>

            <div
              className={cn(
                "text-[13px] tabular-nums",
                changeColor,
              )}
            >
              {formatPercent(change)}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex gap-5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
          <Stat
            label="Mark Price"
            value={formatScaled(
              markPrice,
              market.scale,
            )}
          />

          <Stat
            label="24H Volume"
            value={formatScaledVolume(
              volume,
              1,
            )}
          />

          <Stat
            label="24H High"
            value={formatScaled(
              high,
              ENGINE_PRICE_SCALE,
            )}
          />

          <Stat
            label="24H Low"
            value={formatScaled(
              low,
              ENGINE_PRICE_SCALE,
            )}
          />

          <Stat label="Max" value="10x" />
        </div>
      </div>
    </section>
  );
}

export default MarketBanner;
