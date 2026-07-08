"use client"
import { API_BASE } from "@/lib/config";
import { UserContext } from "@/providers/userState";
import { useContext, useState, useEffect } from "react";

type Tab = "ORDERS" | "POSITIONS" |"FILLS"

export function Stakes({ market }: { market: string }){
      const [selectedTab,setSelectedTab] = useState<Tab>("ORDERS")
      const [orders, setOrders] = useState<any[]>([]);
      const [positions, setPositions] = useState<any[]>([]);
      const [fills, setFills] = useState<any[]>([]);
      const [loading, setLoading] = useState(false);

      useEffect(() => {

        if (selectedTab === "ORDERS") {
          fetch(`${API_BASE}/orders/open/${market}`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => setOrders(data.orders ?? []))
            .catch(console.error)
            .finally(() => setLoading(false));
        } else if (selectedTab === "POSITIONS") {
          fetch(`${API_BASE}/positions/open/${market}`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => setPositions(data.payload?.data?.positions ?? []))
            .catch(console.error)
            .finally(() => setLoading(false));
        } else {
          fetch(`${API_BASE}/fills`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => setFills(data.fills ?? []))
            .catch(console.error)
            .finally(() => setLoading(false));
        }
      }, [selectedTab, market]);

      async function cancelOrder(orderId: string) {
        await fetch(`${API_BASE}/order`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, marketId: market }),
        });
        setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      }

  return <div className="rounded-lg border border-zinc-800 m-2 bg-zinc-900">
            <div className="flex flex-row gap-4 border-b border-zinc-800 px-4 py-2">
                <div onClick={()=>setSelectedTab("ORDERS")} className={`${selectedTab==="ORDERS"?"text-white":"text-zinc-500 hover:text-zinc-300"}`+" text-sm cursor-pointer transition-colors"}>
                    orders
                </div>
                <div onClick={()=>setSelectedTab("POSITIONS")} className={`${selectedTab==="POSITIONS"?"text-white":"text-zinc-500 hover:text-zinc-300"}`+" text-sm cursor-pointer transition-colors"}>
                    positions
                </div>
                <div onClick={()=>setSelectedTab("FILLS")} className={`${selectedTab==="FILLS"?"text-white":"text-zinc-500 hover:text-zinc-300"}`+" text-sm cursor-pointer transition-colors"}>
                    fills
                </div>
            </div>
            <div className="p-4">
              {loading ? <div className="text-zinc-500 text-sm">loading...</div> :
                selectedTab === "ORDERS" ? (
                  orders.length === 0 ? <div className="text-zinc-500 text-sm">no open orders</div> :
                  orders.map((o) => (
                    <div key={o.orderId} className="flex flex-row items-center gap-x-4 border-b border-zinc-800 py-2.5">
                      <span className={o.side === "LONG" ? "text-green-500 w-12 text-sm font-medium" : "text-red-500 w-12 text-sm font-medium"}>{o.side}</span>
                      <span className="w-16 text-zinc-400 text-sm">{o.type}</span>
                      <span className="w-20 text-zinc-300 text-sm">qty: {o.qty?.toString()}</span>
                      <span className="w-24 text-zinc-400 text-sm">filled: {o.filled?.toString()}</span>
                      <span className="w-24 text-zinc-400 text-sm">price: {o.price?.toString()}</span>
                      <button onClick={() => cancelOrder(o.orderId)} className="ml-auto text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded transition-colors">Cancel</button>
                    </div>
                  ))
                ) : selectedTab === "POSITIONS" ? (
                  positions.length === 0 ? <div className="text-zinc-500 text-sm">no open positions</div> :
                  positions.map((p, i) => (
                    <div key={i} className="flex flex-row items-center gap-x-4 border-b border-zinc-800 py-2.5">
                      <span className={p.side === "LONG" ? "text-green-500 w-12 text-sm font-medium" : "text-red-500 w-12 text-sm font-medium"}>{p.side}</span>
                      <span className="w-24 text-zinc-300 text-sm">qty: {p.qty?.toString()}</span>
                      <span className="w-24 text-zinc-400 text-sm">entry: {p.avgPrice?.toString()}</span>
                      <span className="w-24 text-zinc-400 text-sm">liq: {p.liquidationPrice?.toString()}</span>
                    </div>
                  ))
                ) : (
                  fills.length === 0 ? <div className="text-zinc-500 text-sm">no fills</div> :
                  fills.map((f, i) => (
                    <div key={i} className="flex flex-row items-center gap-x-4 border-b border-zinc-800 py-2.5">
                      <span className="w-24 text-zinc-300 text-sm">qty: {f.qty?.toString()}</span>
                      <span className="w-24 text-zinc-400 text-sm">price: {f.price?.toString()}</span>
                    </div>
                  ))
                )
              }
            </div>
        </div>
}