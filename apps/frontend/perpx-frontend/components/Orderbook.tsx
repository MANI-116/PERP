"use client"
import { useEffect, useState, useMemo } from "react"
import { motion } from "motion/react"
import React from "react";
import { OrderbookStore, OrderBook, Socket, MarketManager } from "@/lib/socketManager";

function useOrderBook(marketId: string) {
  const [snapshot, setSnapshot] = useState<OrderBook>(new OrderBook());

  useEffect(() => {
    (async function () {
      Socket.getInstance();
      OrderbookStore.getOrderBook(marketId, setSnapshot);
    })();

    return () => {
      (async () => {
        await MarketManager.getInstance().unsubsribe(marketId);
      })();
    };
  }, [marketId]);

  return {
    askLevels: snapshot.askLevels,
    bidLevels: snapshot.bidLevels,
    bidsTotalQuantity: snapshot.totalBids,
    asksTotalQuantity: snapshot.totalAsks,
    levels: snapshot.priceLevelsData,
  };
}

export const Orderbook = React.memo(function Orderbook({ marketId }: { marketId: string }) {
  const { askLevels, bidLevels, bidsTotalQuantity, asksTotalQuantity, levels } = useOrderBook(marketId);

  let asksCummulative = 0;
  let bidsCummulative = 0;

  const asks = useMemo(() => {
    let cum = 0;
    const total = asksTotalQuantity || 1;
    return askLevels.map((price) => {
      const qty = levels.get(price) ?? 0;
      cum += qty;
      const selfPercent = Math.floor((qty / total) * 100);
      const percent = Math.floor((cum / total) * 100);
      return { price, qty, cum, selfPercent, percent };
    }).reverse();
  }, [askLevels, asksTotalQuantity, levels]);

  const bids = useMemo(() => {
    let cum = 0;
    const total = bidsTotalQuantity || 1;
    return bidLevels.map((price) => {
      const qty = levels.get(price) ?? 0;
      cum += qty;
      const selfPercent = Math.floor((qty / total) * 100);
      const percent = Math.floor((cum / total) * 100);
      return { price, qty, cum, selfPercent, percent };
    });
  }, [bidLevels, bidsTotalQuantity, levels]);

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
