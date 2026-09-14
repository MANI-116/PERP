import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware.js';
import { responseManager } from '../../util.js';

import { prisma } from '../../lib/db.js';


export async function getEquity(req: AuthRequest, res: Response) {
  try {
    const userId = req.body.userId as string;
    const response = await responseManager.putRequest({
      type: 'GET_EQUITY',
      payload: { userId },
    });
    return res.json({ ...response });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getOpenPositions(req: AuthRequest, res: Response) {
  try {
    const { marketId } = req.params;
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).send({ error: 'plz send correct marketId' });
    }
    const userId = req.body.userId as string;
    const response = await responseManager.putRequest({
      type: 'GET_OPEN_POSITIONS',
      payload: { userId, marketId },
    });
    res.json({ ...response });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getClosedPositions(req: AuthRequest, res: Response) {
  try {
    const { marketId } = req.params;
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).send({ error: 'plz send correct marketId' });
    }
    const userId = req.body.userId as string;
    const response = await responseManager.putRequest({
      type: 'GET_CLOSED_POSITIONS',
      payload: { userId, marketId },
    });
    res.json({ ...response });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getOpenOrders(req: AuthRequest, res: Response) {
  try {
    const userId = req.body.userId;
    const { marketId } = req.params;
    const skip = parseInt(req.query.skip as string) || 0;
    const take = Math.min(parseInt(req.query.take as string) || 20, 100);

    if (typeof marketId !== 'string') {
      return res.send('send proper marketid');
    }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId, marketId, state: { in: ['OPEN','FILLED'] } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where: { userId, marketId, state: { in: ['OPEN'] } } }),
    ]);

    const parsed = orders.map((o) => ({
      ...o,
      qty: o.qty.toString(),
      filled: o.filled.toString(),
      price: o.price.toString(),
      slippage: o.slippage?.toString() ?? null,
    }));

    return res.status(200).json({ orders: parsed, total, skip, take });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getAllOrders(req: AuthRequest, res: Response) {
  try {
    const userId = req.body.userId;
    const { marketId } = req.params;
    const skip = parseInt(req.query.skip as string) || 0;
    const take = Math.min(parseInt(req.query.take as string) || 20, 100);

    if (typeof marketId !== 'string') {
      return res.send('send proper marketid');
    }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId, marketId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where: { userId, marketId } }),
    ]);

    const parsed = orders.map((o) => ({
      ...o,
      qty: o.qty.toString(),
      filled: o.filled.toString(),
      price: o.price.toString(),
      slippage: o.slippage?.toString() ?? null,
    }));

    return res.status(200).json({ orders: parsed, total, skip, take });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getFills(req: AuthRequest, res: Response) {
  const userId = req.body.userId;
  const skip = parseInt(req.query.skip as string) || 0;
  const take = Math.min(parseInt(req.query.take as string) || 20, 100);

  try {
    const [fills, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { OR: [{ takerId: userId }, { makerId: userId }] },
        select: { qty: true, price: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({ where: { OR: [{ takerId: userId }, { makerId: userId }] } }),
    ]);

    const parsed = fills.map((f) => ({
      qty: f.qty.toString(),
      price: f.price.toString(),
      createdAt: f.createdAt.toISOString(),
    }));

    return res.status(200).json({ fills: parsed, total, skip, take });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getMarkets(req: Request, res: Response) {
  try {
    const markets = await prisma.market.findMany();
    const parsed = markets.map((m) => ({
      ...m,
      scale: m.scale.toString(),
      markPrice: m.markPrice.toString(),
      lastPrice: m.lastPrice?.toString() ?? null,
      takerRate: m.takerRate.toString(),
      makerRate: m.makerRate.toString(),
      mmr: m.mmr.toString(),
    }));
    return res.status(200).json({ markets: parsed });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getDepth(req: AuthRequest, res: Response) {
  try {
    const { marketId } = req.params;
    if (typeof marketId !== 'string') {
      return res.status(400).send({ error: 'plz send correct marketId' });
    }

    console.log('marketid for depth:',marketId);

    const response = await responseManager.putRequest({
      type: 'GET_DEPTH',
      payload: { marketId },
    });
    console.log('response from the getDepth', response);
    return res.status(200).json({ ...response });
  } catch (error) {
    return res.status(500).json({ error:error,message:"internal server error" });
  }
}

export async function getOi(req: AuthRequest, res: Response) {
  try {
    const { marketId } = req.params;
    if (typeof marketId !== 'string') {
      return res.status(400).send({ error: 'plz send correct marketId' });
    }

    const response = await responseManager.putRequest({
      type: 'GET_OI',
      payload: { marketId },
    });

    return res.status(200).json({ ...response });
  } catch (error) {
    return res.status(500).json({ error, message: 'internal server error' });
  }
}

/**
 * Fetch the engine's open interest for a market.
 *
 * Returns `null` when the engine is unreachable or the market
 * is unknown, so callers can degrade gracefully.
 */
async function fetchOpenInterest(
  marketId: string,
): Promise<string | null> {
  try {
    const response = await responseManager.putRequest({
      type: 'GET_OI',
      payload: { marketId },
    });

    return response?.data?.openInterest ?? null;
  } catch (error) {
    console.error('getOpenInterest error:', marketId, error);
    return null;
  }
}

/**
 * Timeframes the API can serve.
 *
 * Only 1m candles are persisted; every other
 * timeframe is aggregated from them on read.
 */
const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

/**
 * Upper bound on how many 1m rows we are willing
 * to read for a single aggregated request.
 */
const MAX_SOURCE_CANDLES = 20_000;

type SourceCandle = {
  timestamp: Date;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  volume: bigint;
  trades: bigint;
};

type AggregatedCandle = {
  timestamp: number;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  volume: bigint;
  trades: bigint;
};

/**
 * Fold 1m candles into the requested interval.
 *
 * Assumes `source` is ordered ascending by time.
 */
function aggregateCandles(
  source: SourceCandle[],
  intervalMs: number,
  limit: number
): AggregatedCandle[] {
  const buckets = new Map<number, AggregatedCandle>();

  for (const candle of source) {
    const bucket =
      Math.floor(candle.timestamp.getTime() / intervalMs) *
      intervalMs;

    const existing = buckets.get(bucket);

    if (!existing) {
      buckets.set(bucket, {
        timestamp: bucket,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        trades: candle.trades,
      });

      continue;
    }

    if (candle.high > existing.high) {
      existing.high = candle.high;
    }

    if (candle.low < existing.low) {
      existing.low = candle.low;
    }

    existing.close = candle.close;
    existing.volume += candle.volume;
    existing.trades += candle.trades;
  }

  return [...buckets.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);
}

export async function getCandles(
  req: Request,
  res: Response
) {
  try {
    const marketId = String(req.params.marketId ?? "");

    const interval = String(req.query.interval ?? "1m");
    const intervalMs = INTERVAL_MS[interval];

    const limit = Math.min(
      Number(req.query.limit ?? 500),
      1000
    );

    if (!marketId) {
      return res.status(400).json({
        success: false,
        message: "marketId is required",
      });
    }

    if (!intervalMs) {
      return res.status(400).json({
        success: false,
        message: `unsupported interval: ${interval}`,
      });
    }

    /**
     * 1m is the stored source of truth.
     */
    if (interval === "1m") {
      const candles = await prisma.candle.findMany({
        where: {
          marketId,
          interval: "1m",
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
      });

      candles.reverse();

      return res.json({
        success: true,
        data: candles.map((candle) => ({
          timestamp: candle.timestamp.getTime(),

          open: candle.open.toString(),
          high: candle.high.toString(),
          low: candle.low.toString(),
          close: candle.close.toString(),
          volume: candle.volume.toString(),
          trades: candle.trades.toString(),
        })),
      });
    }

    /**
     * Aggregate larger timeframes from 1m candles.
     *
     * Read enough 1m rows to build `limit` bars,
     * bounded by MAX_SOURCE_CANDLES.
     */
    const factor = intervalMs / 60_000;

    const sourceLimit = Math.min(
      Math.ceil(limit * factor),
      MAX_SOURCE_CANDLES
    );

    const source = await prisma.candle.findMany({
      where: {
        marketId,
        interval: "1m",
      },
      orderBy: {
        timestamp: "desc",
      },
      take: sourceLimit,
    });

    source.reverse();

    const aggregated = aggregateCandles(
      source,
      intervalMs,
      limit
    );

    return res.json({
      success: true,
      data: aggregated.map((candle) => ({
        timestamp: candle.timestamp,

        open: candle.open.toString(),
        high: candle.high.toString(),
        low: candle.low.toString(),
        close: candle.close.toString(),
        volume: candle.volume.toString(),
        trades: candle.trades.toString(),
      })),
    });
  } catch (error) {
    console.error("getCandles error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch candles",
    });
  }
}

/**
 * Rolling 24h ticker window.
 */
const TICKER_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Build 24h ticker stats from the stored 1m candles.
 *
 * Pass `marketIds` to scope to specific markets.
 */
async function buildTickers(marketIds?: string[]) {
  const since = new Date(Date.now() - TICKER_WINDOW_MS);

  const markets = await prisma.market.findMany({
    where: marketIds
      ? { id: { in: marketIds } }
      : undefined,
  });

  if (markets.length === 0) {
    return [];
  }

  const ids = markets.map((market) => market.id);

  const [windowAgg, latestAgg] = await Promise.all([
    prisma.candle.groupBy({
      by: ["marketId"],
      where: {
        marketId: { in: ids },
        interval: "1m",
        timestamp: { gte: since },
      },
      _min: { low: true, timestamp: true },
      _max: { high: true, timestamp: true },
      _sum: { volume: true, trades: true },
    }),
    prisma.candle.groupBy({
      by: ["marketId"],
      where: {
        marketId: { in: ids },
        interval: "1m",
      },
      _max: { timestamp: true },
    }),
  ]);

  const openConditions = windowAgg
    .filter((entry) => entry._min.timestamp)
    .map((entry) => ({
      marketId: entry.marketId,
      timestamp: entry._min.timestamp as Date,
    }));

  const lastConditions = latestAgg
    .filter((entry) => entry._max.timestamp)
    .map((entry) => ({
      marketId: entry.marketId,
      timestamp: entry._max.timestamp as Date,
    }));

  const [opens, lasts] = await Promise.all([
    openConditions.length
      ? prisma.candle.findMany({
          where: { interval: "1m", OR: openConditions },
          select: { marketId: true, open: true },
        })
      : Promise.resolve([] as { marketId: string; open: bigint }[]),
    lastConditions.length
      ? prisma.candle.findMany({
          where: { interval: "1m", OR: lastConditions },
          select: { marketId: true, close: true },
        })
      : Promise.resolve([] as { marketId: string; close: bigint }[]),
  ]);

  const windowByMarket = new Map(
    windowAgg.map((entry) => [entry.marketId, entry])
  );

  const openByMarket = new Map(
    opens.map((candle) => [candle.marketId, candle.open])
  );

  const lastByMarket = new Map(
    lasts.map((candle) => [candle.marketId, candle.close])
  );

  const oiEntries = await Promise.all(
    markets.map(async (market) => {
      const openInterest = await fetchOpenInterest(market.id);
      return [market.id, openInterest] as const;
    })
  );

  const openInterestByMarket = new Map(oiEntries);

  return markets.map((market) => {
    const agg = windowByMarket.get(market.id);

    const open24h = openByMarket.get(market.id) ?? null;

    const lastPrice =
      lastByMarket.get(market.id) ??
      market.lastPrice ??
      // `market.markPrice` is stored in `market.scale` units while
      // engine trade/candle prices use a fixed 1e8 scale. Convert so
      // the ticker always returns a single, consistent scale.
      (market.scale > 0n
        ? (market.markPrice * 100_000_000n) / market.scale
        : market.markPrice);

    const high24h = agg?._max.high ?? null;
    const low24h = agg?._min.low ?? null;
    const volume24h = agg?._sum.volume ?? BigInt(0);
    const trades24h = agg?._sum.trades ?? BigInt(0);

    const change24hAbs =
      open24h !== null
        ? lastPrice - open24h
        : null;

    const change24h =
      open24h !== null && open24h !== BigInt(0)
        ? (Number(lastPrice - open24h) /
            Number(open24h)) *
          100
        : 0;

    return {
      marketId: market.id,
      name: market.name,
      symbol: market.symbol,
      scale: market.scale.toString(),

      lastPrice: lastPrice.toString(),
      markPrice: market.markPrice.toString(),

      open24h: open24h?.toString() ?? null,
      high24h: high24h?.toString() ?? null,
      low24h: low24h?.toString() ?? null,

      volume24h: volume24h.toString(),
      trades24h: trades24h.toString(),

      openInterest: openInterestByMarket.get(market.id) ?? null,

      change24h,
      change24hAbs:
        change24hAbs?.toString() ?? null,
    };
  });
}

export async function getTicker(
  req: Request,
  res: Response
) {
  try {
    const marketId = String(
      req.params.marketId ?? ""
    );

    if (!marketId) {
      return res.status(400).json({
        success: false,
        message: "marketId is required",
      });
    }

    const tickers = await buildTickers([marketId]);
    const ticker = tickers[0];

    if (!ticker) {
      return res.status(404).json({
        success: false,
        message: "market not found",
      });
    }

    return res.status(200).json({
      success: true,
      ticker,
    });
  } catch (error) {
    console.error("getTicker error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticker",
    });
  }
}

export async function getTickers(
  _req: Request,
  res: Response
) {
  try {
    const tickers = await buildTickers();

    return res.status(200).json({
      success: true,
      tickers,
    });
  } catch (error) {
    console.error("getTickers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickers",
    });
  }
}
