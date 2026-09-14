"use client";

import { motion } from "motion/react";
import React from "react";
import { useOrderBook } from "@/hooks";
import { SkeletonRow } from "./SkeletonRow";

/** Engine prices are stored as integers scaled by 1e8. */
function formatPrice(price: number): string {
  const value = price / 100_000_000;

  if (!Number.isFinite(value)) {
    return "--";
  }

  const abs = Math.abs(value);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 8;

  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export const Orderbook = React.memo(function Orderbook({
  marketId,
}: {
  marketId: string;
}) {
  const raw = useOrderBook(marketId);

  if (raw.state === "loading") {
    return (
      <div className="flex h-full w-full flex-col bg-zinc-900">

        <OrderbookHeader />

        <div className="space-y-1 px-3 py-2">
          {[...Array(12)].map((_, i) => (
            <SkeletonRow
              key={i}
              width={`${55 + ((i * 5) % 35)}%`}
            />
          ))}
        </div>

      </div>
    );
  }

  if (raw.state === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-900 text-xs text-[#8b929b]">
        Failed to load order book
      </div>
    );
  }

  if (raw.orderbook === null) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b0d10] text-xs text-[#8b929b]">
        No order book data
      </div>
    );
  }

  const book = raw.orderbook;

  let cum = 0;

  const askTotal = book.totalAsks || 1;

  const asks = book.askLevels
    .map((price) => {
      const qty = book.askLevelsData.get(price) ?? 0;

      cum += qty;

      return {
        price,
        qty,
        cum,
        selfPercent: Math.floor((qty / askTotal) * 100),
        percent: Math.floor((cum / askTotal) * 100),
      };
    })
    .reverse();

  cum = 0;

  const bidTotal = book.totalBids || 1;

  const bids = book.bidLevels.map((price) => {
    const qty = book.bidLevelsData.get(price) ?? 0;

    cum += qty;

    return {
      price,
      qty,
      cum,
      selfPercent: Math.floor((qty / bidTotal) * 100),
      percent: Math.floor((cum / bidTotal) * 100),
    };
  });

  const bestBid = book.bidLevels[0] ?? null;
  const bestAsk = book.askLevels[0] ?? null;

  const spread =
    bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  const mid =
    bestBid !== null && bestAsk !== null
      ? (bestBid + bestAsk) / 2
      : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-full w-full flex-col overflow-hidden bg-zinc-900"
    >

      <OrderbookHeader />

      <div className="min-h-0 flex-1 overflow-y-auto">

        {/* ASKS */}
        <div className="px-2 pt-2">

          {asks.map(
            ({ price, qty, cum, selfPercent, percent }) => (
              <div
                key={`ask-${price}`}
                className="relative grid grid-cols-3 min-h-[22px] items-center overflow-hidden px-1"
              >

                <div
                  className="absolute inset-y-0 right-0 bg-[#f23645]/10"
                  style={{ width: `${percent}%` }}
                />

                <div
                  className="absolute inset-y-0 right-0 bg-[#f23645]/15"
                  style={{ width: `${selfPercent}%` }}
                />

                <div className="relative z-10 text-[13px] tabular-nums text-[#f23645]">
                  {formatPrice(price)}
                </div>

                <div className="relative z-10 text-right text-[13px] tabular-nums text-[#e6e8eb]">
                  {qty}
                </div>

                <div className="relative z-10 text-right text-[13px] tabular-nums text-[#8b929b]">
                  {cum.toFixed(3)}
                </div>

              </div>
            )
          )}

        </div>


        {/* MID PRICE DIVIDER */}
        <div className="my-2 flex items-center justify-between border-y border-[#1d2025] px-3 py-2">
          <span className="text-[13px] text-[#8b929b]">
            Mid{" "}
            <span className="tabular-nums text-[#e6e8eb]">
              {mid !== null ? formatPrice(mid) : "--"}
            </span>
          </span>

          <span className="text-[13px] text-[#8b929b]">
            Spread{" "}
            <span className="tabular-nums text-[#e6e8eb]">
              {spread !== null ? formatPrice(spread) : "--"}
            </span>
          </span>
        </div>


        {/* BIDS */}
        <div className="px-2 pb-2">

          {bids.map(
            ({ price, qty, cum, selfPercent, percent }) => (
              <div
                key={`bid-${price}`}
                className="relative grid grid-cols-3 min-h-[22px] items-center overflow-hidden px-1"
              >

                <div
                  className="absolute inset-y-0 right-0 bg-[#0ecb81]/10"
                  style={{ width: `${percent}%` }}
                />

                <div
                  className="absolute inset-y-0 right-0 bg-[#0ecb81]/15"
                  style={{ width: `${selfPercent}%` }}
                />

                <div className="relative z-10 text-[13px] tabular-nums text-[#0ecb81]">
                  {formatPrice(price)}
                </div>

                <div className="relative z-10 text-right text-[13px] tabular-nums text-[#e6e8eb]">
                  {qty}
                </div>

                <div className="relative z-10 text-right text-[13px] tabular-nums text-[#8b929b]">
                  {cum.toFixed(3)}
                </div>

              </div>
            )
          )}

        </div>

      </div>
    </motion.div>
  );
});


function OrderbookHeader() {
  return (
    <div className="shrink-0 border-b border-[#1d2025]">

      <div className="flex h-10 items-center px-3">

        <span className="text-[13px] font-medium text-white">
          Book
        </span>

      </div>

      <div className="grid grid-cols-3 px-3 pb-2 text-[13px] font-medium uppercase tracking-wide text-[#8b929b]">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

    </div>
  );
}