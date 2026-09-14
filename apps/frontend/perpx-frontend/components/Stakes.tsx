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
        setPositions(data.data?.positions ?? data.payload?.data?.positions ?? []);
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

  useEffect(() => { setPage(1); setTotal(0); }, [selectedTab]);

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
    <div className="mx-2 mt-2 min-h-[220px] rounded-xl bg-zinc-900">
      <div className="flex items-center gap-1 border-b border-zinc-800 p-1.5">
        {(["ORDERS", "POSITIONS", "FILLS"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSelectedTab(tab)}
            className={`h-8 flex-1 rounded-md text-[13px] font-medium transition-colors ${
              selectedTab === tab
                ? "bg-white/[0.08] text-white"
                : "text-[#8b929b] hover:text-zinc-300"
            }`}
          >
            {tab === "ORDERS" ? "Orders" : tab === "POSITIONS" ? "Positions" : "Fills"}
          </button>
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
                <div key={o.orderId} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-zinc-800 py-3 md:flex md:flex-row md:gap-x-4 md:py-2.5">
                  <span className={(o.side === "LONG" ? "text-[#0ecb81]" : "text-[#f23645]") + " text-sm font-medium md:w-12"}>{o.side}</span>
                  <span className="text-sm text-zinc-400 md:w-16">{o.type}</span>
                  <span className="text-sm text-zinc-300 md:w-20">qty: {o.qty}</span>
                  <span className="text-sm text-zinc-400 md:w-24">filled: {o.filled}</span>
                  <span className="text-sm text-zinc-400 md:w-24">price: {o.price/100_000_000}</span>
                  <button onClick={() => cancelOrder(o.orderId)} className="col-span-2 justify-self-start text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded transition-colors md:col-span-1 md:ml-auto">Cancel</button>
                </div>
              ))}
              <Pagination page={page} total={total} onPrev={prevPage} onNext={nextPage} />
            </>
          )
        ) : selectedTab === "POSITIONS" ? (
          positions.length === 0 ? (
            <div className="text-zinc-500 text-sm">no open positions</div>
          ) : (
            positions.map((p) => (
              <div key={p.id} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-zinc-800 py-3 md:flex md:flex-row md:gap-x-4 md:py-2.5">
                <span className={(p.side === "LONG" ? "text-[#0ecb81]" : "text-[#f23645]") + " text-sm font-medium md:w-12"}>{p.side}</span>
                <span className="text-sm text-zinc-300 md:w-24">qty: {p.qty}</span>
                <span className="text-sm text-zinc-400 md:w-24">entry: {p.avgPrice/100_000_000}</span>
                <span className="text-sm text-zinc-400 md:w-24">liq: {p.liquidationPrice/100_000_000}</span>
              </div>
            ))
          )
        ) : (
          fills.length === 0 ? (
            <div className="text-zinc-500 text-sm">no fills</div>
          ) : (
            <>
              {fills.map((f, i) => (
                <div key={i} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-zinc-800 py-3 md:flex md:flex-row md:gap-x-4 md:py-2.5">
                  <span className="text-sm text-zinc-300 md:w-24">qty: {f.qty}</span>
                  <span className="text-sm text-zinc-400 md:w-24">price: {f.price/100_000_000}</span>
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
