"use client";

import { useState } from "react";

import { MarketBanner } from "@/components/MarketBanner";
import { CandlestickChart } from "@/components/CandlestickChart";
import { Orderbook } from "@/components/Orderbook";
import { Stakes } from "@/components/Stakes";
import { OrderForm } from "@/components/OrderrForm";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TradeActionBar } from "@/components/ui/TradeActionBar";
import type { BackendMarket } from "@/types";

type WorkspaceTab = "chart" | "book" | "positions";

const TABS: { key: WorkspaceTab; label: string }[] = [
  { key: "chart", label: "Chart" },
  { key: "book", label: "Order Book" },
  { key: "positions", label: "Positions" },
];

/**
 * Responsive trading terminal.
 *
 * - phone (`<md`): tabbed workspace + sticky Buy/Sell bar that
 *   opens the order form as a bottom sheet.
 * - tablet (`md`): chart/book/positions stacked beside the order
 *   form column.
 * - laptop+ (`lg`): chart + order book side by side with the order
 *   form as the right column.
 *
 * Layout only — every panel keeps its own data wiring.
 */
export function TradeWorkspace({
  market,
  userId,
}: {
  market: BackendMarket;
  userId: string;
}) {
  const [tab, setTab] = useState<WorkspaceTab>("chart");
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<"LONG" | "SHORT">("LONG");

  const panelClass = (key: WorkspaceTab) =>
    `${tab === key ? "block" : "hidden"} md:block`;

  return (
    <div className="min-h-dvh pb-28 md:flex md:h-dvh md:flex-col md:overflow-hidden md:pb-0">
      <MarketBanner market={market} />

      <div className="md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------------------------------------------------------------
            WORKSPACE
        ---------------------------------------------------------------- */}
        <div className="min-w-0 md:min-h-0 md:overflow-y-auto">
          {/* Mobile tab switcher */}
          <div className="mx-2 mt-2 flex items-center gap-1 rounded-lg border border-[#1d2025] bg-zinc-900 p-1 md:hidden">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
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

          {/* Chart + order book */}
          <section className="mx-2 mt-2 grid gap-2 lg:min-h-[560px] lg:grid-cols-[minmax(0,1fr)_300px]">
            <div
              className={`${panelClass(
                "chart",
              )} min-h-[380px] min-w-0 overflow-hidden rounded-xl bg-zinc-900 md:min-h-[460px] lg:min-h-0`}
            >
              <CandlestickChart
                marketId={market.id}
                symbol={market.symbol}
                scale={market.scale}
              />
            </div>

            <div
              className={`${panelClass(
                "book",
              )} min-h-[420px] min-w-0 overflow-hidden rounded-xl md:min-h-[520px] lg:min-h-0`}
            >
              <Orderbook marketId={market.id} />
            </div>
          </section>

          {/* Positions / orders / fills */}
          <div className={`${panelClass("positions")} mt-2`}>
            <Stakes market={market.id} />
          </div>
        </div>

        {/* ---------------------------------------------------------------
            DESKTOP / TABLET ORDER FORM COLUMN
        ---------------------------------------------------------------- */}
        <aside className="hidden min-h-0 overflow-y-auto md:mt-2 md:mr-2 md:block md:rounded-xl md:border md:border-[#1d2025] md:bg-zinc-900">
          <OrderForm
            user={userId}
            market={market.id}
            marketInfo={market}
          />
        </aside>
      </div>

      {/* ---------------------------------------------------------------
          MOBILE STICKY ACTION BAR
      ---------------------------------------------------------------- */}
      {!orderOpen && (
        <TradeActionBar
          onBuy={() => {
            setOrderSide("LONG");
            setOrderOpen(true);
          }}
          onSell={() => {
            setOrderSide("SHORT");
            setOrderOpen(true);
          }}
        />
      )}

      {/* ---------------------------------------------------------------
          MOBILE ORDER SHEET
      ---------------------------------------------------------------- */}
      <BottomSheet
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        title={orderSide === "LONG" ? "Buy / Long" : "Sell / Short"}
      >
        <OrderForm
          key={orderSide}
          user={userId}
          market={market.id}
          marketInfo={market}
          initialSide={orderSide}
        />
      </BottomSheet>
    </div>
  );
}
