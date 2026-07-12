"use client"
import { API_BASE } from "@/lib/config";
import { useContext, useState, useEffect, useCallback } from "react";
import { UserContext } from "@/providers/userState";

type Tab = "ORDERS" | "POSITIONS" |"FILLS"
const PAGE_SIZE = 10;

function Pagination({ page, total, onPrev, onNext }: { page: number; total: number; onPrev: () => void; onNext: () => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  return (
    <div className="flex items-center justify-center gap-3 mt-3 text-sm">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition-colors"
      >
        ← Prev
      </button>
      <span className="text-zinc-500">{page} / {totalPages || 1}</span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

export function Stakes({ market }: { market: string }){

  const [selectedTab,setSelectedTab] = useState<Tab>("ORDERS")
  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [fills, setFills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const skip = (page - 1) * PAGE_SIZE;
    try {
      if (selectedTab === "ORDERS") {
        const res = await fetch(`${API_BASE}/orders/open/${market}?skip=${skip}&take=${PAGE_SIZE}`, { credentials: "include" });
        const data = await res.json();
        setOrders(data.orders ?? []);
        setTotal(data.total ?? 0);
      } else if (selectedTab === "POSITIONS") {
        const res = await fetch(`${API_BASE}/positions/open/${market}`, { credentials: "include" });
        const data = await res.json();
        setPositions(data.payload?.data?.positions ?? []);
      } else {
        const res = await fetch(`${API_BASE}/fills?skip=${skip}&take=${PAGE_SIZE}`, { credentials: "include" });
        const data = await res.json();
        setFills(data.fills ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTab, market, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => { setPage(1); }, [selectedTab]);

  function prevPage() { setPage(p => Math.max(1, p - 1)); }
  function nextPage() { setPage(p => p + 1); }

  async function cancelOrder(orderId: string) {
    await fetch(`${API_BASE}/order`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, marketId: market }),
    });
    setOrders(prev => prev.filter(o => o.orderId !== orderId));
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex flex-row gap-4 border-b border-zinc-800 px-4 py-2">
        {(["ORDERS", "POSITIONS", "FILLS"] as const).map((tab) => (
          <div
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`${selectedTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"} text-sm cursor-pointer transition-colors`}
          >
            {tab === "ORDERS" ? "orders" : tab === "POSITIONS" ? "positions" : "fills"}
          </div>
        ))}
      </div>
      <div className="p-4">
        {loading ? (
          <div className="text-zinc-500 text-sm py-2">loading...</div>
        ) : selectedTab === "ORDERS" ? (
          orders.length === 0 ? (
            <div className="text-zinc-500 text-sm">no open orders</div>
          ) : (
            <>
              {orders.map((o) => (
                <div key={o.orderId} className="flex flex-row items-center gap-x-4 border-b border-zinc-800 py-2.5">
                  <span className={o.side === "LONG" ? "text-green-500 w-12 text-sm font-medium" : "text-red-500 w-12 text-sm font-medium"}>{o.side}</span>
                  <span className="w-16 text-zinc-400 text-sm">{o.type}</span>
                  <span className="w-20 text-zinc-300 text-sm">qty: {o.qty}</span>
                  <span className="w-24 text-zinc-400 text-sm">filled: {o.filled}</span>
                  <span className="w-24 text-zinc-400 text-sm">price: {o.price}</span>
                  <button onClick={() => cancelOrder(o.orderId)} className="ml-auto text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded transition-colors">Cancel</button>
                </div>
              ))}
              <Pagination page={page} total={total} onPrev={prevPage} onNext={nextPage} />
            </>
          )
        ) : selectedTab === "POSITIONS" ? (
          positions.length === 0 ? (
            <div className="text-zinc-500 text-sm">no open positions</div>
          ) : (
            positions.map((p, i) => (
              <div key={i} className="flex flex-row items-center gap-x-4 border-b border-zinc-800 py-2.5">
                <span className={p.side === "LONG" ? "text-green-500 w-12 text-sm font-medium" : "text-red-500 w-12 text-sm font-medium"}>{p.side}</span>
                <span className="w-24 text-zinc-300 text-sm">qty: {p.qty}</span>
                <span className="w-24 text-zinc-400 text-sm">entry: {p.avgPrice}</span>
                <span className="w-24 text-zinc-400 text-sm">liq: {p.liquidationPrice}</span>
              </div>
            ))
          )
        ) : (
          fills.length === 0 ? (
            <div className="text-zinc-500 text-sm">no fills</div>
          ) : (
            <>
              {fills.map((f, i) => (
                <div key={i} className="flex flex-row items-center gap-x-4 border-b border-zinc-800 py-2.5">
                  <span className="w-24 text-zinc-300 text-sm">qty: {f.qty}</span>
                  <span className="w-24 text-zinc-400 text-sm">price: {f.price}</span>
                </div>
              ))}
              <Pagination page={page} total={total} onPrev={prevPage} onNext={nextPage} />
            </>
          )
        )}
      </div>
    </div>
  );
}
