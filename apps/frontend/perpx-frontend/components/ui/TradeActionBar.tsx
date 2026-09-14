"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { useMediaQuery } from "@/hooks/useMediaQuery";

const emptySubscribe = () => () => {};

/**
 * Phone-only sticky Buy/Sell bar.
 *
 * Rendered through a portal into `document.body` so no ancestor
 * stacking context, transform, or overflow can affect it, and
 * positioned with inline styles (with a safe-area fallback) so it
 * is always pinned to the bottom regardless of the active panel.
 */
export function TradeActionBar({
  onBuy,
  onSell,
}: {
  onBuy: () => void;
  onSell: () => void;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!mounted || isDesktop) {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
        zIndex: 45,
      }}
      className="flex gap-2 border-t border-[#1d2025] bg-zinc-950/95 p-2 backdrop-blur"
    >
      <button
        type="button"
        onClick={onBuy}
        className="h-10 flex-1 rounded-md bg-[#0ecb81] text-[13px] font-semibold text-black transition-colors hover:bg-[#18d98d]"
      >
        Buy / Long
      </button>

      <button
        type="button"
        onClick={onSell}
        className="h-10 flex-1 rounded-md bg-[#f23645] text-[13px] font-semibold text-white transition-colors hover:bg-[#ff4352]"
      >
        Sell / Short
      </button>
    </div>,
    document.body,
  );
}
