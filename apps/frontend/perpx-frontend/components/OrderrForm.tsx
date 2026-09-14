"use client";

import { API_BASE } from "@/lib/config";
import { useEffect, useState } from "react";

type Side = "LONG" | "SHORT";
type OrderType = "LIMIT" | "MARKET";

export function OrderForm({
  user,
  market,
  marketInfo,
  initialSide,
}: {
  user: string;
  market: string;
  marketInfo: {
    scale: string | number;
    symbol?: string;
    takerRate?: string;
    makerRate?: string;
  } | null;
  initialSide?: Side;
}) {
  const [side, setSide] = useState<Side>(initialSide ?? "SHORT");
  const [type, setType] = useState<OrderType>("LIMIT");

  const [limitPrice, setLimitPrice] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");

  const [leverage, setLeverage] = useState<number>(1);

  const [submitting, setSubmitting] = useState(false);

  const [orderResult, setOrderResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const MAX_LEVERAGE = 10;

  const scale = marketInfo?.scale ?? 1;

  const [available, setAvailable] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/equity/available`, {
          credentials: "include",
        });
        const data = await res.json();

        if (!cancelled && data?.data?.available !== undefined) {
          setAvailable(Number(data.data.available));
        }
      } catch (err) {
        console.error("order form: available balance failed", err);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSideClick(nextSide: Side) {
    if (submitting) return;

    setSide(nextSide);
    setOrderResult(null);
  }

  function handleTypeClick(nextType: OrderType) {
    if (submitting) return;

    setType(nextType);
    setOrderResult(null);

    if (nextType === "MARKET") {
      setLimitPrice("");
    }
  }

  function handleQuantityChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const value = e.target.value;

    if (value === "") {
      setQuantity("");
      return;
    }

    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setQuantity(value);
    setOrderResult(null);
  }

  function handlePriceChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const value = e.target.value;

    if (value === "") {
      setLimitPrice("");
      return;
    }

    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setLimitPrice(value);
    setOrderResult(null);
  }

  function handleLeverageChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const value = Number(e.target.value);

    if (!Number.isFinite(value)) {
      return;
    }

    setLeverage(
      Math.min(
        MAX_LEVERAGE,
        Math.max(1, Math.floor(value))
      )
    );
  }

  const scaleNum = Number(scale) || 1;
  const baseAsset =
    marketInfo?.symbol?.replace(/USDT$/i, "") || "Contracts";
  const takerRate = Number(marketInfo?.takerRate ?? 0);

  const availableUsd = available / 100_000_000;

  const priceNum = Number(limitPrice);
  const qtyNum = Number(quantity);

  const notional =
    type === "LIMIT" &&
    Number.isFinite(priceNum) &&
    Number.isFinite(qtyNum) &&
    priceNum > 0 &&
    qtyNum > 0
      ? priceNum * qtyNum
      : 0;

  const estFee = (notional * takerRate) / scaleNum;
  const requiredMargin = leverage > 0 ? notional / leverage : 0;

  function setPercent(percent: number) {
    if (submitting) return;

    if (type !== "LIMIT" || !Number.isFinite(priceNum) || priceNum <= 0) {
      return;
    }

    const usable = availableUsd * (percent / 100) * leverage;
    const nextQty = Math.floor(usable / priceNum);

    setQuantity(nextQty > 0 ? String(nextQty) : "");
    setOrderResult(null);
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (submitting) {
      return;
    }

    setOrderResult(null);

    const parsedQuantity = Number(quantity);

    if (
      !quantity ||
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      setOrderResult({
        type: "error",
        message: "Enter a valid quantity",
      });

      return;
    }

    if (type === "LIMIT") {
      const parsedPrice = Number(limitPrice);

      if (
        !limitPrice ||
        !Number.isFinite(parsedPrice) ||
        parsedPrice <= 0
      ) {
        setOrderResult({
          type: "error",
          message: "Enter a valid limit price",
        });

        return;
      }
    }

    const normalizedLeverage = Math.min(
      MAX_LEVERAGE,
      Math.max(1, Math.floor(leverage))
    );

    let scaledPrice = "0";

    if (type === "LIMIT") {

      scaledPrice = limitPrice;
    
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/order`, {
        method: "POST",

        credentials: "include",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          type,
          marketId: market,
          side,

          leverage: String(normalizedLeverage),

          qty: String(
            Math.floor(parsedQuantity)
          ),

          price:
            type === "MARKET"
              ? "0"
              : scaledPrice,
        }),
      });

      let data: any;

      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid backend response");
      }

      console.log("order-result:", data);

      if (!res.ok) {
        setOrderResult({
          type: "error",
          message:
            data?.error ??
            data?.message ??
            "Failed to place order",
        });

        return;
      }

      if (data.event === "ORDER_ACCEPTED") {
        setOrderResult({
          type: "success",
          message: `Order accepted — ${quantity} ${side}`,
        });

        setQuantity("");
        setLimitPrice("");

        return;
      }

      if (
        data.event === "ORDER_FILLED" ||
        data.event === "ORDER_FILLED_PARTIALLY"
      ) {
        setOrderResult({
          type: "success",
          message: `Order filled — ${quantity} ${side}`,
        });

        setQuantity("");
        setLimitPrice("");

        return;
      }

      if (data.event === "ORDER_REJECTED") {
        setOrderResult({
          type: "error",
          message:
            data.error ??
            data.message ??
            "Order rejected",
        });

        return;
      }

      setOrderResult({
        type: "error",
        message: "Unexpected response from backend",
      });
    } catch (error) {
      console.error("Order placement error:", error);

      setOrderResult({
        type: "error",
        message: "Network error — check backend",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full w-full  bg-zinc-900">

      {/* =========================================================
          HEADER
      ========================================================== */}
      <div className="flex h-10 items-center border-b border-[#252930] px-4">
        <span className="text-[13px] font-medium text-white">
          Place Order
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4"
      >

        {/* =======================================================
            BUY / SELL
        ======================================================== */}
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#252930] bg-[#101216]">

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSideClick("LONG")}
            className={`
              h-9 text-[13px] font-medium
              transition-all duration-150
              disabled:cursor-not-allowed
              ${
                side === "LONG"
                  ? "bg-[#0ecb81] text-black"
                  : "text-[#8b929b] hover:bg-[#171a1f] hover:text-white"
              }
            `}
          >
            Buy / Long
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSideClick("SHORT")}
            className={`
              h-9 text-[13px] font-medium
              transition-all duration-150
              disabled:cursor-not-allowed
              ${
                side === "SHORT"
                  ? "bg-[#f23645] text-white"
                  : "text-[#8b929b] hover:bg-[#171a1f] hover:text-white"
              }
            `}
          >
            Sell / Short
          </button>

        </div>

        {/* =======================================================
            ORDER TYPE
        ======================================================== */}
        <div className="mt-5 flex items-center gap-5 border-b border-[#252930]">

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleTypeClick("LIMIT")}
            className={`
              relative pb-2.5 text-[13px]
              transition-colors
              ${
                type === "LIMIT"
                  ? "font-medium text-white"
                  : "text-[#8b929b] hover:text-[#aeb4bb]"
              }
            `}
          >
            Limit

            {type === "LIMIT" && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
            )}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleTypeClick("MARKET")}
            className={`
              relative pb-2.5 text-[13px]
              transition-colors
              ${
                type === "MARKET"
                  ? "font-medium text-white"
                  : "text-[#8b929b] hover:text-[#aeb4bb]"
              }
            `}
          >
            Market

            {type === "MARKET" && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
            )}
          </button>

        </div>

        {/* =======================================================
            ORDER FIELDS
        ======================================================== */}
        <div className="mt-5 space-y-3">

          {/* PRICE */}
          {type === "LIMIT" ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="limit-price"
                  className="text-[13px] text-[#8b929b]"
                >
                  Price
                </label>

                <span className="text-[13px] text-[#8b929b]">
                  USDT
                </span>
              </div>

              <div className="flex h-10 items-center rounded-md border border-[#252930] bg-[#101216] transition-colors focus-within:border-[#41464e]">
                <input
                  id="limit-price"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={limitPrice}
                  onChange={handlePriceChange}
                  disabled={submitting}
                  placeholder="0.00"
                  className="
                    h-full min-w-0 flex-1
                    bg-transparent px-3
                    text-right text-[13px]
                    tabular-nums text-white
                    outline-none
                    placeholder:text-[#8b929b]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                />

                <span className="px-3 text-[13px] text-[#8b929b]">
                  USDT
                </span>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] text-[#8b929b]">
                  Price
                </span>

                <span className="text-[13px] text-[#8b929b]">
                  USDT
                </span>
              </div>

              <div className="flex h-10 items-center rounded-md border border-[#252930] bg-[#101216] px-3">
                <span className="flex-1 text-right text-[13px] text-[#8b929b]">
                  Market
                </span>

                <span className="ml-3 text-[13px] text-[#8b929b]">
                  USDT
                </span>
              </div>
            </div>
          )}

          {/* QUANTITY */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="order-quantity"
                className="text-[13px] text-[#8b929b]"
              >
                Quantity
              </label>

              <span className="text-[13px] text-[#8b929b]">
                Contracts
              </span>
            </div>

            <div className="flex h-10 items-center rounded-md border border-[#252930] bg-[#101216] transition-colors focus-within:border-[#41464e]">
              <input
                id="order-quantity"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={quantity}
                onChange={handleQuantityChange}
                disabled={submitting}
                placeholder="0"
                className="
                  h-full min-w-0 flex-1
                  bg-transparent px-3
                  text-right text-[13px]
                  tabular-nums text-white
                  outline-none
                  placeholder:text-[#8b929b]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              />

              <span className="px-3 text-[13px] text-[#8b929b]">
                {baseAsset}
              </span>
            </div>

            {/* Percentage shortcuts */}
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={submitting || type !== "LIMIT"}
                  onClick={() => setPercent(p)}
                  className="h-7 rounded-md border border-[#252930] bg-[#101216] text-[13px] text-[#8b929b] transition-colors hover:border-[#41464e] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

        </div>

       

        {/* =======================================================
            LEVERAGE
        ======================================================== */}
        <div className="mt-5">

          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] text-[#8b929b]">
              Leverage
            </span>

            <span className="text-[13px] font-medium tabular-nums text-white">
              {leverage}x
            </span>
          </div>

          <div className="relative px-1">

            <input
              type="range"
              min={1}
              max={MAX_LEVERAGE}
              step={1}
              value={leverage}
              onChange={handleLeverageChange}
              disabled={submitting}
              className="
                h-1.5 w-full
                cursor-pointer appearance-none
                rounded-full bg-[#252930]
                accent-white
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            />

            <div className="mt-2 flex justify-between text-[13px] text-[#8b929b]">
              <span>1x</span>
              <span>2x</span>
              <span>5x</span>
              <span>10x</span>
            </div>

          </div>
        </div>

        {/* =======================================================
            ORDER SUMMARY
        ======================================================== */}
        <div className="mt-5 space-y-2 border-t border-[#252930] pt-4">

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#8b929b]">
              Order
            </span>

            <span
              className={`
                text-[13px] font-medium
                ${
                  side === "LONG"
                    ? "text-[#0ecb81]"
                    : "text-[#f23645]"
                }
              `}
            >
              {side === "LONG" ? "Long" : "Short"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#8b929b]">
              Type
            </span>

            <span className="text-[13px] text-[#c2c7cf]">
              {type}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#8b929b]">
              Quantity
            </span>

            <span className="text-[13px] tabular-nums text-[#c2c7cf]">
              {quantity || "0"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#8b929b]">
              Leverage
            </span>

            <span className="text-[13px] tabular-nums text-[#c2c7cf]">
              {leverage}x
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-[#252930]/60 pt-2">
            <span className="text-[13px] text-[#8b929b]">Available</span>
            <span className="text-[13px] tabular-nums text-[#c2c7cf]">
              {availableUsd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDT
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#8b929b]">Order Value</span>
            <span className="text-[13px] tabular-nums text-[#c2c7cf]">
              {notional.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDT
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#8b929b]">Est. Fee</span>
            <span className="text-[13px] tabular-nums text-[#c2c7cf]">
              {estFee.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}{" "}
              USDT
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#8b929b]">Margin</span>
            <span className="text-[13px] tabular-nums text-[#c2c7cf]">
              {requiredMargin.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDT
            </span>
          </div>

        </div>

        {/* =======================================================
            RESULT MESSAGE
        ======================================================== */}
        {orderResult && (
          <div
            className={`
              mt-4 rounded-md border px-3 py-2.5
              text-[13px]
              ${
                orderResult.type === "success"
                  ? "border-[#0ecb81]/15 bg-[#0ecb81]/[0.06] text-[#0ecb81]"
                  : "border-[#f23645]/15 bg-[#f23645]/[0.06] text-[#f23645]"
              }
            `}
          >
            {orderResult.message}
          </div>
        )}

        {/* =======================================================
            SUBMIT BUTTON
        ======================================================== */}
        <button
          type="submit"
          disabled={
            submitting ||
            !quantity ||
            Number(quantity) <= 0 ||
            (type === "LIMIT" &&
              (!limitPrice ||
                Number(limitPrice) <= 0))
          }
          className={`
            mt-5 h-11 w-full
            rounded-md
            text-[13px] font-semibold
            transition-all
            ${
              side === "LONG"
                ? "bg-[#0ecb81] text-black hover:bg-[#18d98d]"
                : "bg-[#f23645] text-white hover:bg-[#ff4352]"
            }
            disabled:cursor-not-allowed
            disabled:bg-[#252930]
            disabled:text-[#8b929b]
            disabled:hover:bg-[#252930]
          `}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="
                  h-3 w-3
                  animate-spin
                  rounded-full
                  border border-current/30
                  border-t-current
                "
              />

              Placing order...
            </span>
          ) : (
            <>
              {side === "LONG"
                ? "Buy / Long"
                : "Sell / Short"}
            </>
          )}
        </button>

        {/* =======================================================
            FOOTER
        ======================================================== */}
        <div className="mt-4 flex items-center justify-between text-[13px] text-[#8b929b]">
          <span>
            Perpetual Futures
          </span>

          <span>
            {leverage}x max
          </span>
        </div>

      </form>
    </div>
  );
}