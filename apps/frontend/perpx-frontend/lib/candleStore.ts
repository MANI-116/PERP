import { MarketManager } from "./socketManager";
import { API_BASE } from "./config";
import {
  TIMEFRAME_MS,
  type Timeframe,
} from "./timeframes";
import type { Candle, TradeTick } from "@/types";

export type { Candle };

/**
 * Rolling window kept in memory and rendered.
 */
const MAX_CANDLES = 360;

export type CandleSnapshotHandler = (
  candles: Candle[],
) => void;

export type CandleUpdateHandler = (
  candle: Candle,
) => void;

function bucket(
  timestamp: number,
  intervalMs: number,
): number {
  return (
    Math.floor(timestamp / intervalMs) *
    intervalMs
  );
}

function safeBigInt(
  value: string,
): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function comparePrice(
  a: string,
  b: string,
): number {
  const left = safeBigInt(a);
  const right = safeBigInt(b);

  if (left === null || right === null) {
    return 0;
  }

  if (left < right) return -1;
  if (left > right) return 1;

  return 0;
}

/**
 * A "no trade" candle: carries the previous
 * close forward with zero volume.
 */
function createFlatCandle(
  timestamp: number,
  close: string,
): Candle {
  return {
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume: "0",
    trades: "0",
  };
}

function createCandleFromTrade(
  timestamp: number,
  price: string,
  qty: string,
): Candle {
  return {
    timestamp,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: qty,
    trades: "1",
  };
}

function mergeTrade(
  candle: Candle,
  price: string,
  qty: string,
): Candle {
  const addQty = safeBigInt(qty);
  const volume =
    safeBigInt(candle.volume) ?? BigInt(0);
  const trades =
    safeBigInt(candle.trades) ?? BigInt(0);

  return {
    timestamp: candle.timestamp,
    open: candle.open,
    high:
      comparePrice(price, candle.high) > 0
        ? price
        : candle.high,
    low:
      comparePrice(price, candle.low) < 0
        ? price
        : candle.low,
    close: price,
    volume:
      addQty === null
        ? candle.volume
        : (volume + addQty).toString(),
    trades: (
      trades + BigInt(1)
    ).toString(),
  };
}

function normalizeCandle(
  candle: Candle,
): Candle {
  return {
    timestamp: Number(candle.timestamp),
    open: String(candle.open),
    high: String(candle.high),
    low: String(candle.low),
    close: String(candle.close),
    volume: String(candle.volume),
    trades: String(candle.trades),
  };
}

/**
 * Build a continuous, gap-free window of candles
 * ending at the current bucket for the interval.
 */
function buildContinuousWindow(
  source: Candle[],
  intervalMs: number,
  limit: number,
): Candle[] {
  if (source.length === 0) {
    return [];
  }

  const end = bucket(Date.now(), intervalMs);
  const start =
    end - (limit - 1) * intervalMs;

  const byBucket = new Map<number, Candle>();

  let seed: string | null = null;

  for (const candle of source) {
    if (candle.timestamp < start) {
      seed = candle.close;
    } else if (candle.timestamp <= end) {
      byBucket.set(candle.timestamp, candle);
    }
  }

  if (seed === null) {
    for (
      let t = start;
      t <= end;
      t += intervalMs
    ) {
      const candle = byBucket.get(t);

      if (candle) {
        seed = candle.open;
        break;
      }
    }
  }

  const result: Candle[] = [];

  let previousClose = seed ?? "0";

  for (
    let t = start;
    t <= end;
    t += intervalMs
  ) {
    const existing = byBucket.get(t);

    if (existing) {
      result.push(existing);
      previousClose = existing.close;
    } else {
      result.push(
        createFlatCandle(t, previousClose),
      );
    }
  }

  return result;
}

export class CandleStore {
  private candles: Candle[] = [];

  /**
   * bucket timestamp -> index into candles
   */
  private index = new Map<number, number>();

  /**
   * Ticks received while the REST snapshot was
   * still loading. Replayed once the snapshot lands.
   */
  private pending: TradeTick[] = [];

  private ready = false;

  private stopped = false;

  private dirty = new Set<number>();

  private frame: number | null = null;

  private timer: ReturnType<
    typeof setTimeout
  > | null = null;

  private unsubscribeCandles:
    | (() => void)
    | null = null;

  private updateHandler: (
    tick: TradeTick,
  ) => void;

  private readonly intervalMs: number;

  private constructor(
    private marketId: string,
    private timeframe: Timeframe,
    private onSnapshot: CandleSnapshotHandler,
    private onUpdate: CandleUpdateHandler,
  ) {
    this.intervalMs = TIMEFRAME_MS[timeframe];

    this.updateHandler =
      this.applyTradeTick.bind(this);
  }

  static async getCandles(
    marketId: string,
    timeframe: Timeframe,
    onSnapshot: CandleSnapshotHandler,
    onUpdate: CandleUpdateHandler,
  ): Promise<CandleStore> {
    const store = new CandleStore(
      marketId,
      timeframe,
      onSnapshot,
      onUpdate,
    );

    const manager =
      MarketManager.getInstance();

    /**
     * Subscribe before the snapshot so no live
     * tick is missed. Ticks are buffered until
     * the snapshot resolves.
     */
    store.unsubscribeCandles =
      manager.subscribe(
        marketId,
        "candle",
        store.updateHandler,
      );

    try {
      await store.setSnapshot();
    } catch (error) {
      store.unsubscribe();

      throw error;
    }

    store.ready = true;

    store.replayPending();

    store.startClock();

    onSnapshot([...store.candles]);

    return store;
  }

  unsubscribe(): void {
    this.stopped = true;

    if (this.unsubscribeCandles) {
      this.unsubscribeCandles();
      this.unsubscribeCandles = null;
    }

    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.pending = [];
    this.dirty.clear();
  }

  private async setSnapshot(): Promise<void> {
    const res = await fetch(
      `${API_BASE}/candles/${this.marketId}?interval=${this.timeframe}&limit=${MAX_CANDLES}`,
      {
        credentials: "include",
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to fetch candles: ${res.status}`,
      );
    }

    const payload = await res.json();

    const source = (
      (payload.data ?? payload) as Candle[]
    )
      .map(normalizeCandle)
      .sort(
        (a, b) =>
          a.timestamp - b.timestamp,
      );

    this.candles = buildContinuousWindow(
      source,
      this.intervalMs,
      MAX_CANDLES,
    );

    this.reindex();
  }

  private reindex(): void {
    this.index.clear();

    for (
      let i = 0;
      i < this.candles.length;
      i++
    ) {
      this.index.set(
        this.candles[i].timestamp,
        i,
      );
    }
  }

  private replayPending(): void {
    const pending = this.pending;

    this.pending = [];

    for (const tick of pending) {
      this.ingestTick(tick);
    }
  }

  private applyTradeTick(
    tick: TradeTick,
  ): void {
    if (!this.ready) {
      this.pending.push(tick);

      return;
    }

    this.ingestTick(tick);
  }

  private ingestTick(tick: TradeTick): void {
    const timestamp = bucket(
      Number(tick.timestamp),
      this.intervalMs,
    );

    if (!Number.isFinite(timestamp)) {
      return;
    }

    if (
      this.candles.length > 0 &&
      timestamp <
        this.candles[0].timestamp
    ) {
      return;
    }

    this.ensureContinuity(timestamp);

    const trades = tick.candles ?? [];

    for (const trade of trades) {
      const price = String(trade.price);
      const qty = String(trade.qty);

      const idx = this.index.get(timestamp);

      if (idx === undefined) {
        this.candles.push(
          createCandleFromTrade(
            timestamp,
            price,
            qty,
          ),
        );

        this.candles.sort(
          (a, b) =>
            a.timestamp - b.timestamp,
        );

        this.reindex();
      } else {
        this.candles[idx] = mergeTrade(
          this.candles[idx],
          price,
          qty,
        );
      }

      this.markDirty(timestamp);
    }

    this.trim();
  }

  /**
   * Materialise every missing bucket up to `target`
   * as a flat candle carrying the previous close.
   */
  private ensureContinuity(target: number): void {
    const last =
      this.candles[
        this.candles.length - 1
      ];

    if (!last || target <= last.timestamp) {
      return;
    }

    const steps =
      (target - last.timestamp) /
      this.intervalMs;

    if (steps > MAX_CANDLES) {
      const start =
        target -
        (MAX_CANDLES - 1) * this.intervalMs;

      const rebuilt: Candle[] = [];

      for (
        let t = start;
        t <= target;
        t += this.intervalMs
      ) {
        rebuilt.push(
          createFlatCandle(t, last.close),
        );
      }

      this.candles = rebuilt;
      this.reindex();

      for (const candle of rebuilt) {
        this.markDirty(candle.timestamp);
      }

      return;
    }

    for (
      let t = last.timestamp + this.intervalMs;
      t <= target;
      t += this.intervalMs
    ) {
      const previous =
        this.candles[
          this.candles.length - 1
        ];

      this.candles.push(
        createFlatCandle(t, previous.close),
      );

      this.index.set(
        t,
        this.candles.length - 1,
      );

      this.markDirty(t);
    }
  }

  private trim(): void {
    if (
      this.candles.length <= MAX_CANDLES
    ) {
      return;
    }

    this.candles.splice(
      0,
      this.candles.length - MAX_CANDLES,
    );

    this.reindex();
  }

  /**
   * Drive candle formation even when no trades
   * arrive, so the chart keeps building bars.
   */
  private startClock(): void {
    this.scheduleNextRollover();
  }

  private scheduleNextRollover(): void {
    if (this.stopped) {
      return;
    }

    const now = Date.now();

    const next =
      bucket(now, this.intervalMs) +
      this.intervalMs;

    const delay =
      Math.max(0, next - now) + 50;

    this.timer = setTimeout(() => {
      this.timer = null;

      if (this.stopped) {
        return;
      }

      this.ensureContinuity(
        bucket(Date.now(), this.intervalMs),
      );

      this.trim();

      this.scheduleNextRollover();
    }, delay);
  }

  private markDirty(timestamp: number): void {
    this.dirty.add(timestamp);

    if (this.frame !== null) {
      return;
    }

    this.frame = requestAnimationFrame(() => {
      this.frame = null;

      this.flush();
    });
  }

  /**
   * Coalesce every tick within a frame into a
   * single notification per changed candle.
   */
  private flush(): void {
    const timestamps = [...this.dirty];

    this.dirty.clear();

    for (const timestamp of timestamps) {
      const idx = this.index.get(timestamp);

      if (idx === undefined) {
        continue;
      }

      this.onUpdate({
        ...this.candles[idx],
      });
    }
  }
}
