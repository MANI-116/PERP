"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { AnimatePresence, motion } from "framer-motion";

import { useCandles } from "@/hooks/useCandles";
import type { Candle } from "@/lib/candleStore";
import {
  TIMEFRAMES,
  DEFAULT_TIMEFRAME,
  type Timeframe,
} from "@/lib/timeframes";
import { ENGINE_PRICE_SCALE } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type DisplayCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
};

type Props = {
  marketId: string;
  symbol: string;
  scale: string | number | bigint;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Convert backend scaled integer strings
 * into display numbers.
 */
function toDisplayCandle(
  candle: Candle,
): DisplayCandle {
  return {
    timestamp: candle.timestamp,

    open:
      Number(candle.open) / ENGINE_PRICE_SCALE,

    high:
      Number(candle.high) / ENGINE_PRICE_SCALE,

    low:
      Number(candle.low) / ENGINE_PRICE_SCALE,

    close:
      Number(candle.close) / ENGINE_PRICE_SCALE,

    // Candle volume is raw contract quantity, not price-scaled.
    volume:
      Number(candle.volume),

    trades:
      Number(candle.trades),
  };
}

function formatPrice(
  value: number,
  decimals: number,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatVolume(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (value >= 1_000_000_000) {
    return `${(
      value / 1_000_000_000
    ).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `${(
      value / 1_000_000
    ).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `${(
      value / 1_000
    ).toFixed(2)}K`;
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

function formatTime(
  timestamp: number,
): string {
  return new Date(
    timestamp,
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * lightweight-charts renders UTCTimestamp values in
 * UTC by default. Format through the user's locale so
 * the crosshair and axis labels read as local time.
 */
function toLocalDate(time: Time): Date {
  return new Date(Number(time) * 1000);
}

function formatCrosshairTime(
  time: Time,
): string {
  return toLocalDate(time).toLocaleString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
}

function formatTickMark(
  time: Time,
  tickMarkType: TickMarkType,
): string {
  const date = toLocalDate(time);

  switch (tickMarkType) {
    case TickMarkType.Year:
      return date.toLocaleDateString(
        undefined,
        {
          year: "numeric",
        },
      );

    case TickMarkType.Month:
      return date.toLocaleDateString(
        undefined,
        {
          month: "short",
        },
      );

    case TickMarkType.DayOfMonth:
      return date.toLocaleDateString(
        undefined,
        {
          day: "2-digit",
          month: "short",
        },
      );

    case TickMarkType.Time:
      return date.toLocaleTimeString(
        undefined,
        {
          hour: "2-digit",
          minute: "2-digit",
        },
      );

    case TickMarkType.TimeWithSeconds:
      return date.toLocaleTimeString(
        undefined,
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      );

    default:
      return date.toLocaleString();
  }
}

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function CandlestickChart({
  marketId,
  symbol,
  scale,
}: Props) {
  const chartContainerRef =
    useRef<HTMLDivElement | null>(null);

  const chartRef =
    useRef<IChartApi | null>(null);

  const candleSeriesRef =
    useRef<
      ISeriesApi<"Candlestick"> | null
    >(null);

  const volumeSeriesRef =
    useRef<
      ISeriesApi<"Histogram"> | null
    >(null);

  const candlesRef =
    useRef<DisplayCandle[]>([]);

  /**
   * Tracks what the series currently holds so we
   * can choose between a full redraw and an
   * incremental update.
   */
  const dataMetaRef = useRef<{
    first: number | null;
    length: number;
    timeframe: Timeframe | null;
  }>({
    first: null,
    length: 0,
    timeframe: null,
  });

  const [timeframe, setTimeframe] =
    useState<Timeframe>(DEFAULT_TIMEFRAME);

  const [isFullscreen, setIsFullscreen] =
    useState(false);

  const [hoverCandle, setHoverCandle] =
    useState<DisplayCandle | null>(null);

  /**
   * `market.scale` is a divisor (e.g. 1_000_000),
   * not a decimal count. Prices and volumes are
   * stored as scaled integers and must be divided
   * by it to reach display units.
   */
  const divisor =
    Number(scale) > 0 ? Number(scale) : 1;

  const scaleLog = Math.log10(divisor);

  const priceDecimals =
    Number.isInteger(scaleLog) &&
    scaleLog >= 0
      ? scaleLog
      : 2;

  /* ---------------------------------------------------------------------- */
  /* Shared candle infrastructure                                           */
  /* ---------------------------------------------------------------------- */

  /**
   * The store now fetches and maintains candles
   * at the selected timeframe, so the hook result
   * is already aggregated.
   */
  const {
    candles,
    loading,
  } = useCandles(marketId, timeframe);

  /**
   * Convert backend scaled candles into display
   * numbers. Derived from the hook result directly
   * so the chart never lags a render behind.
   */
  const displayCandles = useMemo(
    () =>
      candles.map((candle) =>
        toDisplayCandle(candle),
      ),
    [
      candles,
    ],
  );

  /**
   * Ref mirror for the imperative crosshair
   * callback (which cannot read render state).
   */
  useEffect(() => {
    candlesRef.current = displayCandles;
  }, [displayCandles]);

  const latestCandle =
    displayCandles[
      displayCandles.length - 1
    ] ?? null;

  /* ---------------------------------------------------------------------- */
  /* Chart data helpers                                                     */
  /* ---------------------------------------------------------------------- */

  const setChartData = useCallback(
    (data: DisplayCandle[]) => {
      const candleSeries =
        candleSeriesRef.current;

      const volumeSeries =
        volumeSeriesRef.current;

      if (
        !candleSeries ||
        !volumeSeries
      ) {
        return;
      }

      /**
       * lightweight-charts requires ascending,
       * unique times. Normalise defensively so a
       * malformed batch can never silently keep the
       * previous series on screen.
       */
      const sorted = [...data].sort(
        (a, b) => a.timestamp - b.timestamp,
      );

      const deduped: DisplayCandle[] = [];

      for (const candle of sorted) {
        const previous =
          deduped[deduped.length - 1];

        if (
          previous &&
          previous.timestamp === candle.timestamp
        ) {
          deduped[deduped.length - 1] =
            candle;

          continue;
        }

        deduped.push(candle);
      }

      try {
        candleSeries.setData(
          deduped.map((candle) => ({
            time:
              (candle.timestamp /
                1000) as UTCTimestamp,

            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })),
        );

        volumeSeries.setData(
          deduped.map((candle) => ({
            time:
              (candle.timestamp /
                1000) as UTCTimestamp,

            value: candle.volume,

            color:
              candle.close >= candle.open
                ? "rgba(34, 197, 94, 0.30)"
                : "rgba(239, 68, 68, 0.30)",
          })),
        );
      } catch (error) {
        console.error(
          "[chart] setData failed",
          error,
        );
      }
    },
    [],
  );

  const updateLatestCandle =
    useCallback(
      (candle: DisplayCandle) => {
        const candleSeries =
          candleSeriesRef.current;

        const volumeSeries =
          volumeSeriesRef.current;

        if (
          !candleSeries ||
          !volumeSeries
        ) {
          return;
        }

        const time =
          (candle.timestamp / 1000) as UTCTimestamp;

        candleSeries.update({
          time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        });

        volumeSeries.update({
          time,
          value: candle.volume,

          color:
            candle.close >= candle.open
              ? "rgba(34, 197, 94, 0.30)"
              : "rgba(239, 68, 68, 0.30)",
        });
      },
      [],
    );

  /* ---------------------------------------------------------------------- */
  /* Create chart                                                           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const container =
      chartContainerRef.current;

    if (!container) {
      return;
    }

    const chart = createChart(
      container,
      {
        autoSize: true,

        layout: {
          background: {
            type: ColorType.Solid,
            color: "#18181b",
          },

          textColor: "#687386",

          fontFamily:
            "Inter, ui-sans-serif, system-ui, sans-serif",
        },

        grid: {
          vertLines: {
            color:
              "rgba(255,255,255,0.025)",
          },

          horzLines: {
            color:
              "rgba(255,255,255,0.025)",
          },
        },

        crosshair: {
          mode: CrosshairMode.Normal,

          vertLine: {
            color:
              "rgba(255,255,255,0.16)",
            width: 1,
            style: 2,
            labelBackgroundColor:
              "#151a22",
          },

          horzLine: {
            color:
              "rgba(255,255,255,0.16)",
            width: 1,
            style: 2,
            labelBackgroundColor:
              "#151a22",
          },
        },

        rightPriceScale: {
          borderVisible: false,

          scaleMargins: {
            top: 0.08,
            bottom: 0.22,
          },

          textColor: "#8993a3",
        },

        timeScale: {
          borderVisible: false,

          timeVisible: true,

          secondsVisible: false,

          rightOffset: 8,

          barSpacing: 7,

          minBarSpacing: 3,

          fixLeftEdge: false,

          fixRightEdge: false,

          tickMarkFormatter: formatTickMark,
        },

        localization: {
          locale:
            typeof navigator !== "undefined"
              ? navigator.language
              : "en-US",

          timeFormatter: formatCrosshairTime,

          priceFormatter: (
            price: number,
          ) =>
            formatPrice(
              price,
              priceDecimals,
            ),
        },

        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },

        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: true,
        },
      },
    );

    const candleSeries =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor: "#0ecb81",
          downColor: "#f23645",

          borderUpColor:
            "#0ecb81",

          borderDownColor:
            "#f23645",

          wickUpColor:
            "#0ecb81",

          wickDownColor:
            "#f23645",

          priceLineVisible: true,

          lastValueVisible: true,
        },
      );

    const volumeSeries =
      chart.addSeries(
        HistogramSeries,
        {
          priceFormat: {
            type: "volume",
          },

          priceScaleId: "volume",

          color:
            "rgba(255,255,255,0.12)",
        },
      );

    volumeSeries
      .priceScale()
      .applyOptions({
        scaleMargins: {
          top: 0.82,
          bottom: 0,
        },

        borderVisible: false,
      });

    chartRef.current = chart;

    candleSeriesRef.current =
      candleSeries;

    volumeSeriesRef.current =
      volumeSeries;

    /**
     * A freshly created chart holds no data.
     */
    dataMetaRef.current = {
      first: null,
      length: 0,
      timeframe: null,
    };

    /* ------------------------------------------------------------------ */
    /* Crosshair                                                           */
    /* ------------------------------------------------------------------ */

    const crosshairMoveHandler = (
      param: MouseEventParams<Time>,
    ) => {
      if (
        !param ||
        !param.time
      ) {
        setHoverCandle(null);
        return;
      }

      const timestamp =
        Number(param.time) * 1000;

      const candle =
        candlesRef.current.find(
          (item) =>
            item.timestamp ===
            timestamp,
        );

      setHoverCandle(
        candle ?? null,
      );
    };

    chart.subscribeCrosshairMove(
      crosshairMoveHandler,
    );

    /* ------------------------------------------------------------------ */
    /* Cleanup                                                             */
    /* ------------------------------------------------------------------ */

    return () => {
      chart.unsubscribeCrosshairMove(
        crosshairMoveHandler,
      );

      chart.remove();

      chartRef.current = null;

      candleSeriesRef.current =
        null;

      volumeSeriesRef.current =
        null;
    };
  }, [divisor, priceDecimals]);

  /* ---------------------------------------------------------------------- */
  /* Sync chart data                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const chart = chartRef.current;

    if (
      !chart ||
      !candleSeriesRef.current ||
      !volumeSeriesRef.current ||
      displayCandles.length === 0
    ) {
      return;
    }

    const first =
      displayCandles[0].timestamp;

    const latest =
      displayCandles[
        displayCandles.length - 1
      ];

    const meta = dataMetaRef.current;

    /**
     * The dataset was replaced (first load, market
     * change, reload or timeframe switch). These
     * also reset the visible range.
     */
    const datasetChanged =
      meta.first === null ||
      meta.first !== first ||
      meta.timeframe !== timeframe ||
      displayCandles.length < meta.length;

    /**
     * Gap filling / interval rollover can append
     * more than one candle at once. A single
     * `series.update` cannot add those, so redraw.
     */
    const appendedMany =
      displayCandles.length - meta.length > 1;

    const needsFullRedraw =
      datasetChanged || appendedMany;

    if (needsFullRedraw) {
      setChartData(displayCandles);

      if (datasetChanged) {
        requestAnimationFrame(() => {
          chart.timeScale().fitContent();
        });
      }
    } else {
      updateLatestCandle(latest);
    }

    dataMetaRef.current = {
      first,
      length: displayCandles.length,
      timeframe,
    };
  }, [
    displayCandles,
    timeframe,
    setChartData,
    updateLatestCandle,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Fullscreen                                                              */
  /* ---------------------------------------------------------------------- */

  const toggleFullscreen =
    useCallback(() => {
      setIsFullscreen(
        (current) => !current,
      );
    }, []);

  /* ---------------------------------------------------------------------- */
  /* Header data                                                             */
  /* ---------------------------------------------------------------------- */

  const displayCandle =
    hoverCandle ??
    latestCandle;

  const priceChange =
    displayCandle &&
    displayCandle.open !== 0
      ? ((displayCandle.close -
          displayCandle.open) /
          displayCandle.open) *
        100
      : 0;

  const hasData =
    candles.length > 0;

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <motion.section
      layout
      className={cn(
        "relative overflow-hidden rounded-xl",
        "bg-zinc-900",
        "shadow-[0_24px_80px_rgba(0,0,0,0.32)]",
        isFullscreen &&
          "fixed inset-3 z-[100] rounded-2xl",
      )}
    >
      {/* Ambient top glow */}
      <div
        className="
          pointer-events-none
          absolute inset-x-0 top-0 h-24
          bg-gradient-to-b
          from-white/[0.025]
          to-transparent
        "
      />

      {/* Header */}
      <div
        className="
          relative flex flex-col
          border-b border-white/[0.055]
        "
      >
        {/* Market information */}
        <div
          className="
            flex min-h-[68px]
            items-center justify-between
            gap-4 px-4
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                flex h-9 w-9 items-center
                justify-center rounded-lg
                border border-white/[0.08]
                bg-white/[0.035]
                text-xs font-bold
                text-white
              "
            >
              {symbol
                .replace("USDT", "")
                .slice(0, 3)}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="
                    text-sm font-semibold
                    tracking-tight text-white
                  "
                >
                  {symbol}
                </h2>

                <span
                  className="
                    rounded-md
                    border border-white/[0.06]
                    bg-white/[0.035]
                    px-1.5 py-0.5
                    text-[13px] font-medium
                    uppercase tracking-wider
                    text-zinc-500
                  "
                >
                  Perpetual
                </span>
              </div>

              <p
                className="
                  mt-0.5 text-[13px]
                  text-zinc-600
                "
              >
                {symbol} · Perpetual Futures
              </p>
            </div>

            {/* Data state */}
            <div className="ml-2 flex items-center gap-1.5">
              <motion.span
                animate={{
                  opacity:
                    loading
                      ? 0.5
                      : [0.45, 1, 0.45],
                }}
                transition={{
                  duration: 2,
                  repeat:
                    loading
                      ? 0
                      : Infinity,
                }}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  loading
                    ? "bg-zinc-600"
                    : hasData
                      ? "bg-[#0ecb81]"
                      : "bg-zinc-600",
                )}
              />

              <span
                className={cn(
                  "text-[13px] font-medium",
                  loading
                    ? "text-zinc-600"
                    : hasData
                      ? "text-[#0ecb81]"
                      : "text-zinc-600",
                )}
              >
                {loading
                  ? "Loading"
                  : hasData
                    ? "Live"
                    : "No data"}
              </span>
            </div>
          </div>

          {/* Current price */}
          <div className="hidden text-right sm:block">
            <div
              className="
                text-lg font-semibold
                tracking-tight text-white
              "
            >
              {displayCandle
                ? formatPrice(
                    displayCandle.close,
                    priceDecimals,
                  )
                : "—"}
            </div>

            {displayCandle && (
              <div
                className={cn(
                  "text-[13px] font-medium",
                  priceChange >= 0
                    ? "text-[#0ecb81]"
                    : "text-[#f23645]",
                )}
              >
                {priceChange >= 0
                  ? "+"
                  : ""}
                {priceChange.toFixed(2)}%
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div
          className="
            flex h-11 items-center
            gap-1 overflow-x-auto
            border-t border-white/[0.035]
            px-3 scrollbar-none
          "
        >
          <span
            className="
              mr-2 shrink-0
              text-[13px] font-semibold
              uppercase tracking-[0.16em]
              text-zinc-600
            "
          >
            Chart
          </span>

          {TIMEFRAMES.map(
            (item) => (
              <motion.button
                key={item}
                whileTap={{
                  scale: 0.94,
                }}
                onClick={() =>
                  setTimeframe(item)
                }
                className={cn(
                  "relative h-7 shrink-0",
                  "rounded-md px-2.5",
                  "text-[13px] font-medium",
                  "transition-colors",
                  timeframe === item
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300",
                )}
              >
                {item}

                {timeframe === item && (
                  <motion.div
                    layoutId="active-timeframe"
                    className="
                      absolute inset-x-2
                      -bottom-[1px]
                      h-px bg-white/50
                    "
                  />
                )}
              </motion.button>
            ),
          )}

          <div className="flex-1" />

          <button
            onClick={
              toggleFullscreen
            }
            className="
              flex h-7 w-7 shrink-0
              items-center justify-center
              rounded-md
              text-zinc-600
              transition-colors
              hover:bg-white/[0.05]
              hover:text-zinc-300
            "
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M21 16h-5v5" />
              </svg>
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M8 3H3v5M21 8V3h-5M3 16v5h5M16 21h5v-5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* OHLC strip */}
      <div
        className="
          flex h-8 items-center
          gap-4 overflow-x-auto
          border-b border-white/[0.035]
          px-4 scrollbar-none
        "
      >
        <Ohlc
          label="O"
          value={
            displayCandle
              ? formatPrice(
                  displayCandle.open,
                  priceDecimals,
                )
              : "—"
          }
        />

        <Ohlc
          label="H"
          value={
            displayCandle
              ? formatPrice(
                  displayCandle.high,
                  priceDecimals,
                )
              : "—"
          }
        />

        <Ohlc
          label="L"
          value={
            displayCandle
              ? formatPrice(
                  displayCandle.low,
                  priceDecimals,
                )
              : "—"
          }
        />

        <Ohlc
          label="C"
          value={
            displayCandle
              ? formatPrice(
                  displayCandle.close,
                  priceDecimals,
                )
              : "—"
          }
          positive={
            displayCandle
              ? displayCandle.close >=
                displayCandle.open
              : undefined
          }
        />

        <Ohlc
          label="VOL"
          value={
            displayCandle
              ? formatVolume(
                  displayCandle.volume,
                )
              : "—"
          }
        />

        {hoverCandle && (
          <span
            className="
              ml-auto shrink-0
              text-[13px] text-zinc-600
            "
          >
            {formatTime(
              hoverCandle.timestamp,
            )}
          </span>
        )}
      </div>

      {/* Chart */}
      <div
        className={cn(
          "relative",
          isFullscreen
            ? "h-[calc(100dvh-150px)]"
            : "h-[clamp(300px,50vh,420px)] md:h-[480px] lg:h-[560px]",
        )}
      >
        <div
          ref={chartContainerRef}
          className="
            absolute inset-0
            bg-zinc-900
          "
        />

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              className="
                absolute inset-0
                flex items-center
                justify-center
                bg-[#080b10]/80
                backdrop-blur-[2px]
              "
            >
              <div
                className="
                  flex items-center gap-2
                  rounded-lg
                  bg-zinc-900
                  px-3 py-2
                  text-[13px]
                  text-zinc-500
                "
              >
                <motion.span
                  animate={{
                    rotate: 360,
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="
                    h-3 w-3
                    rounded-full
                    border border-white/10
                    border-t-white/60
                  "
                />

                Loading market data
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        <AnimatePresence>
          {!loading &&
            !hasData && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 5,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="
                  absolute inset-0
                  flex items-center
                  justify-center
                "
              >
                <div
                  className="
                    rounded-lg
                    bg-zinc-900
                    px-4 py-3
                    text-center
                  "
                >
                  <div
                    className="
                      text-xs font-medium
                      text-zinc-400
                    "
                  >
                    No market data
                  </div>

                  <div
                    className="
                      mt-1 text-[13px]
                      text-zinc-600
                    "
                  >
                    Waiting for candle data
                  </div>
                </div>
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div
        className="
          flex h-8 items-center
          justify-between
          bg-zinc-900
          px-4
          text-[13px]
          text-zinc-600
        "
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1 w-1 rounded-full",
              loading
                ? "bg-zinc-700"
                : hasData
                  ? "bg-[#0ecb81]"
                  : "bg-zinc-700",
            )}
          />

          <span>
            {loading
              ? "Loading market data"
              : hasData
                ? "Live market data"
                : "Waiting for market data"}
          </span>
        </div>

        <div className="hidden sm:block">
          Base candles · 1m
        </div>

        <div>
          {symbol} Perpetual
        </div>
      </div>
    </motion.section>
  );
}

/* -------------------------------------------------------------------------- */
/* OHLC component                                                             */
/* -------------------------------------------------------------------------- */

function Ohlc({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <span
      className="
        flex shrink-0
        items-center gap-1.5
        text-[13px]
      "
    >
      <span className="text-zinc-600">
        {label}
      </span>

      <span
        className={cn(
          "font-medium",

          positive === undefined
            ? "text-zinc-400"
            : positive
              ? "text-[#0ecb81]"
              : "text-[#f23645]",
        )}
      >
        {value}
      </span>
    </span>
  );
}

export default CandlestickChart;
