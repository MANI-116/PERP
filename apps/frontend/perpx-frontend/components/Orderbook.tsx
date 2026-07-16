"use client"
import { useEffect, useState, useMemo } from "react"
import { motion } from "motion/react"
import React from "react";
import {  OrderBook } from "@/lib/socketManager";
import { useOrderBook } from "@/hooks";
import { SkeletonRow } from "./SkeletonRow";




export const Orderbook = React.memo(function Orderbook({ marketId }: { marketId: string }) {
  const raw = useOrderBook(marketId);
  
  console.log("marketId-",marketId);
  console.log("raw orderbook state-",raw);
  if(raw.state === "loading"){
    return <OrderbookHeader> 
      <div className="px-1 space-y-2 py-1">
          {[...Array(8)].map((_, i) => <SkeletonRow key={i} width={`${55 + (i * 5) % 35}%`} />)}
        </div>
    </OrderbookHeader >
  }

  if(raw.state === "error"){
    return <div>
      Error
    </div>

  }
  
  if(raw.orderbook === null){
    return <div>
      No data
    </div>
  }

  const book = raw.orderbook;
  
    let cum = 0;
    let total = book.totalAsks || 1;
    const asks = book.askLevels.map((price) => {
      const qty = book.priceLevelsData.get(price) ?? 0;
      cum += qty;
      return { price, qty, cum, selfPercent: Math.floor((qty / total) * 100), percent: Math.floor((cum / total) * 100) };
    }).reverse();

  
    
     cum = 0;
     total = book.totalBids || 1;
    const bids =  book.bidLevels.map((price) => {
      const qty = book.priceLevelsData.get(price) ?? 0;
      cum += qty;
      return { price, qty, cum, selfPercent: Math.floor((qty / total) * 100), percent: Math.floor((cum / total) * 100) };
    });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col w-80 max-w-96 bg-zinc-900 border border-zinc-800 rounded-lg ml-2 overflow-hidden"
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

function OrderbookHeader(props:React.PropsWithChildren){
  
  return <motion.div
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

      {props.children}

    </motion.div>
}