"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { UserContext } from "@/providers/userState";
import { API_BASE } from "@/lib/config";
import { formatScaled, ENGINE_PRICE_SCALE } from "@/lib/format";
import type { BackendMarket } from "@/types";

type Tab = "ORDERS" | "POSITIONS" | "FILLS";

type OrderRow = {
  orderId: string;
  side: string;
  type: string;
  qty: string;
  filled: string;
  price: string;
  state: string;
  marketId: string;
  symbol?: string;
};

type PositionRow = {
  id: string;
  side: string;
  qty: string;
  avgPrice: string;
  liquidationPrice: string;
  state: string;
};

type FillRow = {
  qty: string;
  price: string;
  createdAt: string;
};

type Balance = {
  equity: string;
  available: string;
  locked: string;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "ORDERS", label: "Orders" },
  { key: "POSITIONS", label: "Positions" },
  { key: "FILLS", label: "Fills" },
];

function formatUsd(value: string | undefined): string {
  const num = Number(value ?? 0) / ENGINE_PRICE_SCALE;

  if (!Number.isFinite(num)) {
    return "0.00";
  }

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sideColor(side: string): string {
  return side === "LONG" ? "text-[#0ecb81]" : "text-[#f23645]";
}

export default function UserAccount() {
  const { user, setUser } = useContext(UserContext);
  const router = useRouter();

  const [depositOpen, setDepositOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [ramping, setRamping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState<Balance>({
    equity: "0",
    available: "0",
    locked: "0",
  });

  const [markets, setMarkets] = useState<BackendMarket[]>([]);
  const [tab, setTab] = useState<Tab>("ORDERS");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [fills, setFills] = useState<FillRow[]>([]);

  /* ------------------------------------------------------------------
   * Balance + market list
   * ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [balanceRes, marketsRes] = await Promise.all([
          fetch(`${API_BASE}/equity/available`, {
            credentials: "include",
          }),
          fetch(`${API_BASE}/markets`),
        ]);

        const balanceData = await balanceRes.json();
        const marketsData = await marketsRes.json();

        if (cancelled) return;

        if (balanceData?.data) {
          setBalance({
            equity: balanceData.data.equity ?? "0",
            available: balanceData.data.available ?? "0",
            locked: balanceData.data.locked ?? "0",
          });
        }

        setMarkets(marketsData?.markets ?? []);
      } catch (err) {
        console.error("account: failed to load balance/markets", err);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------
   * Tab data
   * ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (tab === "ORDERS") {
          const collected: OrderRow[] = [];

          for (const market of markets) {
            const res = await fetch(
              `${API_BASE}/orders/open/${market.id}?skip=0&take=50`,
              { credentials: "include" },
            );
            const data = await res.json();

            for (const order of data?.orders ?? []) {
              collected.push({ ...order, symbol: market.symbol });
            }
          }

          if (!cancelled) setOrders(collected);
          return;
        }

        if (tab === "POSITIONS") {
          const marketId = markets[0]?.id;

          if (!marketId) return;

          const res = await fetch(
            `${API_BASE}/positions/open/${marketId}`,
            { credentials: "include" },
          );
          const data = await res.json();

          if (!cancelled) {
            setPositions(data?.data?.positions ?? []);
          }
          return;
        }

        const res = await fetch(
          `${API_BASE}/fills?skip=0&take=50`,
          { credentials: "include" },
        );
        const data = await res.json();

        if (!cancelled) setFills(data?.fills ?? []);
      } catch (err) {
        console.error("account: failed to load tab", err);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [tab, markets]);

  /* ------------------------------------------------------------------
   * Actions
   * ------------------------------------------------------------------ */
  function handleLogout() {
    document.cookie = "Authorization=; max-age=0; path=/";
    setUser({ name: "Amigo", isLoggedIn: false, userId: "0" });
    router.push("/");
  }

  async function cancelOrder(orderId: string, marketId: string) {
    try {
      await fetch(`${API_BASE}/order`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, marketId }),
      });

      setOrders((prev) =>
        prev.filter((order) => order.orderId !== orderId),
      );
    } catch (err) {
      console.error("account: cancel order failed", err);
    }
  }

  async function handleRamp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setRamping(true);

    try {
      const res = await fetch(`${API_BASE}/onramp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credit: amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Deposit failed");
        return;
      }

      const available = data?.totalAvailable;

      if (available !== undefined) {
        setBalance((prev) => ({
          ...prev,
          available,
          equity: available,
        }));
      }

      setDepositOpen(false);
      setAmount("");
    } catch (err) {
      console.error("account: ramp failed", err);
      setError("Network error");
    } finally {
      setRamping(false);
    }
  }

  const summary: { label: string; value: string; className?: string }[] = [
    { label: "Equity", value: formatUsd(balance.equity) },
    {
      label: "Available",
      value: formatUsd(balance.available),
      className: "text-[#0ecb81]",
    },
    { label: "Locked", value: formatUsd(balance.locked) },
  ];

  return (
    <div className="mx-2 my-2 space-y-2 md:space-y-3">
      {/* =====================================================
          ACCOUNT SUMMARY
      ====================================================== */}
      <section className="rounded-xl bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-100">
                {user.name}
              </div>
              <div className="text-[13px] text-zinc-500">Account</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="shrink-0 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-[#f23645]"
          >
            Log out
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-3">
          {summary.map((item) => (
            <div key={item.label}>
              <div className="text-[13px] uppercase tracking-wider text-zinc-500">
                {item.label}
              </div>
              <div
                className={`mt-0.5 text-sm font-semibold tabular-nums text-zinc-100 ${
                  item.className ?? ""
                }`}
              >
                ${item.value}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setError(null);
            setDepositOpen(true);
          }}
          className="mt-4 h-9 w-full rounded-md bg-[#0ecb81] text-xs font-semibold text-black transition-colors hover:bg-[#18d98d]"
        >
          + Add Funds
        </button>
      </section>

      {/* =====================================================
          TABS
      ====================================================== */}
      <section className="rounded-xl bg-zinc-900">
        <div className="flex items-center gap-1 border-b border-zinc-800 p-1.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`h-8 flex-1 rounded-md text-[13px] font-medium transition-colors ${
                tab === item.key
                  ? "bg-white/[0.08] text-white"
                  : "text-[#8b929b] hover:text-zinc-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="p-3 md:p-4">
          {tab === "ORDERS" &&
            (orders.length === 0 ? (
              <EmptyState message="No open orders" />
            ) : (
              orders.map((order) => (
                <div
                  key={order.orderId}
                  className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-zinc-800 py-3 last:border-b-0 md:flex md:flex-row md:gap-x-4"
                >
                  <span className={`text-sm font-medium md:w-12 ${sideColor(order.side)}`}>
                    {order.side}
                  </span>
                  <span className="text-sm text-zinc-400 md:w-20">
                    {order.symbol ?? order.marketId}
                  </span>
                  <span className="text-sm text-zinc-300 md:w-20">
                    qty: {order.qty}
                  </span>
                  <span className="text-sm text-zinc-400 md:w-24">
                    filled: {order.filled}
                  </span>
                  <span className="text-sm text-zinc-400 md:w-28">
                    price:{" "}
                    {formatScaled(order.price, ENGINE_PRICE_SCALE)}
                  </span>
                  <button
                    onClick={() =>
                      cancelOrder(order.orderId, order.marketId)
                    }
                    className="col-span-2 justify-self-start rounded bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 md:col-span-1 md:ml-auto"
                  >
                    Cancel
                  </button>
                </div>
              ))
            ))}

          {tab === "POSITIONS" &&
            (positions.length === 0 ? (
              <EmptyState message="No open positions" />
            ) : (
              positions.map((position) => (
                <div
                  key={position.id}
                  className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-zinc-800 py-3 last:border-b-0 md:flex md:flex-row md:gap-x-4"
                >
                  <span className={`text-sm font-medium md:w-12 ${sideColor(position.side)}`}>
                    {position.side}
                  </span>
                  <span className="text-sm text-zinc-300 md:w-24">
                    qty: {position.qty}
                  </span>
                  <span className="text-sm text-zinc-400 md:w-32">
                    entry:{" "}
                    {formatScaled(
                      position.avgPrice,
                      ENGINE_PRICE_SCALE,
                    )}
                  </span>
                  <span className="text-sm text-zinc-400 md:w-32">
                    liq:{" "}
                    {formatScaled(
                      position.liquidationPrice,
                      ENGINE_PRICE_SCALE,
                    )}
                  </span>
                </div>
              ))
            ))}

          {tab === "FILLS" &&
            (fills.length === 0 ? (
              <EmptyState message="No fills yet" />
            ) : (
              fills.map((fill, index) => (
                <div
                  key={`${fill.createdAt}-${index}`}
                  className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-zinc-800 py-3 last:border-b-0 md:flex md:flex-row md:gap-x-4"
                >
                  <span className="text-sm text-zinc-300 md:w-24">
                    qty: {fill.qty}
                  </span>
                  <span className="text-sm text-zinc-400 md:w-32">
                    price:{" "}
                    {formatScaled(fill.price, ENGINE_PRICE_SCALE)}
                  </span>
                  <span className="text-[13px] text-zinc-500 md:ml-auto">
                    {new Date(fill.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            ))}
        </div>
      </section>

      {/* =====================================================
          DEPOSIT MODAL
      ====================================================== */}
      {depositOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center">
          <div className="w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:rounded-lg sm:p-6">
            <form onSubmit={handleRamp} className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Add Funds</h2>

              <input
                type="number"
                inputMode="decimal"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-md border border-zinc-800 bg-black/40 p-2.5 text-sm transition-colors focus:border-zinc-600 focus:outline-none"
                required
              />

              {error && (
                <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-[#f23645]">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDepositOpen(false);
                    setAmount("");
                    setError(null);
                  }}
                  className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={ramping}
                  className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-white disabled:opacity-60"
                >
                  {ramping ? "Depositing..." : "Deposit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-zinc-500">{message}</div>
  );
}
