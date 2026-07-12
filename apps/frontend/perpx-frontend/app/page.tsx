"use client"
import { useEffect, useState } from "react"
import Image from "next/image"
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";
import { MarketDisplay, BackendMarket } from "@/types";


const logos: Record<string, string> = {
  "BTC-PERP": "/coins/btc.png",
  "ETH-PERP": "/coins/eth.png",
  "SOL-PERP": "/coins/sol.png",
  "XRP-PERP": "/coins/xrp.png",
  "DOGE-PERP": "/coins/doge.png",
  "BNB-PERP": "/coins/bnb.png",
};

export default function Home() {
  const router = useRouter();
  const [markets, setMarkets] = useState<MarketDisplay[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/markets`)
      .then((r) => r.json())
      .then((data) => {
        const parsed: MarketDisplay[] = data.markets.map((m: BackendMarket) => {
          const scale = Number(m.scale);
          const price = Number(m.markPrice) / scale;
          return {
            symbol: m.symbol,
            name: m.name,
            logo: logos[m.symbol] ?? "/coins/btc.png",
            price,
            volume24h: "—",
            openInterest: "—",
            change24h: 0,
          };
        });
        setMarkets(parsed);
      })
      .catch(console.error);
  }, []);
 
  return (
      <main>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex flex-row gap-x-2 mb-3">
            <div><h2 className="text-lg font-semibold text-zinc-200">Futures</h2></div>
          </div>
          <div className="flex flex-row items-center border-b border-zinc-800 gap-x-1 pb-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">
            <div className="flex-[2]"><h3>Name</h3></div>
            <div className="flex-1"><h3>Price</h3></div>
            <div className="flex-1"><h3>24h Volume</h3></div>
            <div className="flex-1"><h3>Open Interest</h3></div>
            <div className="flex-1"><h3>24h Change</h3></div>
          </div>

          {markets.map((m) => (
            <motion.div
              whileHover={{ scale: 1.01, x: 4 }}
              transition={{ type: "spring", duration: 0.25 }}
              key={m.symbol}
              onClick={() => router.push(`/trade/${m.symbol}`)}
              className="flex flex-row items-center p-2.5 border-b border-zinc-800 gap-x-1 cursor-pointer hover:bg-zinc-800/50 transition-colors rounded"
            >
              <div className="flex-[2]">
                <div className="flex flex-row items-center gap-x-2">
                  <Image src={m.logo} width={24} height={24} className="rounded-full" alt="" />
                  <span className="text-sm font-medium text-zinc-200">{m.name}</span>
                </div>
              </div>
              <div className="flex-1 text-sm text-zinc-300">{m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="flex-1 text-sm text-zinc-500">{m.volume24h}</div>
              <div className="flex-1 text-sm text-zinc-500">{m.openInterest}</div>
              <div className={`flex-1 text-sm ${m.change24h < 0 ? "text-red-500" : "text-green-500"}`}>
                <span>{m.change24h}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
  
  );
}
