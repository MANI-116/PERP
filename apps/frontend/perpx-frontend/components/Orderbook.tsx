"use client"
import { useEffect, useState, useMemo } from "react"
import { motion } from "motion/react"
import React from "react";
import { OrderbookStore, OrderBook, Socket, MarketManager } from "@/lib/socketManager";

function SkeletonRow({ width }: { width: string }) {
  return (
    <div className="flex flex-row mb-px ml-1 mr-1">
      <div className="flex-1"><div className="h-3 bg-zinc-800 rounded animate-pulse" style={{ width }} /></div>
      <div className="flex-1 text-right"><div className="h-3 bg-zinc-800 rounded animate-pulse inline-block" style={{ width: "60%" }} /></div>
      <div className="flex-1 text-right"><div className="h-3 bg-zinc-800 rounded animate-pulse inline-block" style={{ width: "40%" }} /></div>
    </div>
  );
}

function useOrderBook(marketId: string) {
  const [snapshot, setSnapshot] = useState<OrderBook | null>(null);

  useEffect(() => {
    (async function () {
      Socket.getInstance();
      await OrderbookStore.getOrderBook(marketId, setSnapshot);
    })();

    return () => {
      (async () => {
        await MarketManager.getInstance().unsubsribe(marketId);
      })();
    };
  }, [marketId]);

  return snapshot ?? new OrderBook();
}

export const Orderbook = React.memo(function Orderbook({ marketId }: { marketId: string }) {
  const book = useOrderBook(marketId);
  const loaded = book.askLevels.length > 0 || book.bidLevels.length > 0;

  const { askLevels, bidLevels, bidsTotalQuantity, asksTotalQuantity, levels } = loaded ? book : { askLevels: [] as number[], bidLevels: [] as number[], bidsTotalQuantity: 0, asksTotalQuantity: 0, levels: new Map<number, number>() };

  const asks = useMemo(() => {
    if (!loaded) return [];
    let cum = 0;
    const total = asksTotalQuantity || 1;
    return askLevels.map((price) => {
      const qty = levels.get(price) ?? 0;
      cum += qty;
      return { price, qty, cum, selfPercent: Math.floor((qty / total) * 100), percent: Math.floor((cum / total) * 100) };
    }).reverse();
  }, [loaded, askLevels, asksTotalQuantity, levels]);

  const bids = useMemo(() => {
    if (!loaded) return [];
    let cum = 0;
    const total = bidsTotalQuantity || 1;
    return bidLevels.map((price) => {
      const qty = levels.get(price) ?? 0;
      cum += qty;
      return { price, qty, cum, selfPercent: Math.floor((qty / total) * 100), percent: Math.floor((cum / total) * 100) };
    });
  }, [loaded, bidLevels, bidsTotalQuantity, levels]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col w-80 max-w-96 bg-zinc-900 border border-zinc-800 rounded-lg m-2 overflow-hidden"
    >
      <div className="flex flex-row m-2 text-zinc-500 text-xs font-medium">
        <div className="flex-1">Price</div>
        <div className="flex-1 text-right">Size</div>
        <div className="flex-1 text-right">Total</div>
      </div>

      {!loaded && (
        <div className="px-1 space-y-2 py-1">
          {[...Array(8)].map((_, i) => <SkeletonRow key={i} width={`${50 + Math.random() * 40}%`} />)}
        </div>
      )}

      {asks.map(({ price, qty, cum, selfPercent, percent }) => (
        <motion.div
          key={`ask-${price}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-row relative mb-px ml-1 mr-1 overflow-hidden"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3 }}
            className="absolute bg-[#f23645]/20 inset-y-0 right-0"
            style={{ width: `${percent}%` }}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${selfPercent}%` }}
            transition={{ duration: 0.2 }}
            className="absolute bg-[#f23645]/40 inset-y-0 right-0"
            style={{ width: `${selfPercent}%` }}
          />
          <div className="flex-1 text-[#f23645] z-10 text-xs tabular-nums">{price}</div>
          <div className="flex-1 text-zinc-300 z-10 text-xs tabular-nums text-right">{qty}</div>
          <div className="flex-1 text-zinc-400 z-10 text-xs tabular-nums text-right">{cum.toFixed(3)}</div>
        </motion.div>
      ))}

      <div className="h-2" />

      {bids.map(({ price, qty, cum, selfPercent, percent }) => (
        <motion.div
          key={`bid-${price}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-row relative mb-px ml-1 mr-1 overflow-hidden"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3 }}
            className="absolute bg-[#0ecb81]/20 inset-y-0 right-0"
            style={{ width: `${percent}%` }}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${selfPercent}%` }}
            transition={{ duration: 0.2 }}
            className="absolute bg-[#0ecb81]/40 inset-y-0 right-0"
            style={{ width: `${selfPercent}%` }}
          />
          <div className="flex-1 text-[#0ecb81] z-10 text-xs tabular-nums">{price}</div>
          <div className="flex-1 text-zinc-300 z-10 text-xs tabular-nums text-right">{qty}</div>
          <div className="flex-1 text-zinc-400 z-10 text-xs tabular-nums text-right">{cum.toFixed(3)}</div>
        </motion.div>
      ))}
    </motion.div>
  );
});
