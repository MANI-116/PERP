import { prisma } from "../lib/db";
import type { FinalizedCandle } from "./candleConsumer";

export async function saveFinalizedCandle(
    candle: FinalizedCandle
) {
    const timestamp = new Date(candle.timestamp);

    await prisma.candle.upsert({
        where: {
            marketId_interval_timestamp: {
                marketId: candle.marketId,
                interval: candle.interval,
                timestamp,
            },
        },

        create: {
            marketId: candle.marketId,
            interval: candle.interval,
            timestamp,

            open: BigInt(candle.open),
            high: BigInt(candle.high),
            low: BigInt(candle.low),
            close: BigInt(candle.close),
            volume: BigInt(candle.volume),
            trades: BigInt(candle.trades),
        },

        update: {
            open: BigInt(candle.open),
            high: BigInt(candle.high),
            low: BigInt(candle.low),
            close: BigInt(candle.close),
            volume: BigInt(candle.volume),
            trades: BigInt(candle.trades),
        },
    });
}