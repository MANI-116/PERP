import { createClient } from "redis";
import { prisma } from "./lib/db";
import { config } from "./config";
import type { EngineResponse } from "@repo/types";

const receiver =
  config.ENVIRONMENT === "local" ||
  config.ENVIRONMENT === "development"
    ? createClient({ url: config.REDIS_URL })
    : createClient({
        url: config.REDIS_URL,
        socket: { tls: true, rejectUnauthorized: false },
      });

receiver.on("error", (err) =>
  console.error("candleConsumer redis error:", err)
);

const GROUP = "candleConsumer";
const CONSUMER = "candle-worker-1";
const STREAM = "response-stream";

const INTERVALS = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
};

interface RedisResponse {
  name: string;
  messages: {
    id: string;
    message: {
      [key: string]: string;
    };
  }[];
}

export async function startCandleConsumer() {
  await receiver.connect();

  try {
    await receiver.xGroupCreate(STREAM, GROUP, "0", {
      MKSTREAM: true,
    });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("BUSYGROUP")
    ) {
      console.log("error:",error);
      throw error;
    }
  }

  console.log("candleConsumer started");

  while (true) {
    const response = (await receiver.xReadGroup(
      GROUP,
      CONSUMER,
      [{ key: STREAM, id: ">" }],
      { BLOCK: 2000, COUNT: 100 }
    )) as RedisResponse[] | null;

    if (!response?.[0]) continue;

    for (const msg of response[0].messages) {
      try {
        const raw = msg.message.payload;

        if (!raw) {
          await receiver.xAck(STREAM, GROUP, msg.id);
          continue;
        }

        const message = {
          ...msg.message,
          payload: JSON.parse(raw),
        } as unknown as EngineResponse;
        console.log("message is recived for the event:",message.event);

        if (
          message.event !== "ORDER_FILLED" &&
          message.event !== "ORDER_FILLED_PARTIALLY"
        ) {
          await receiver.xAck(STREAM, GROUP, msg.id);
          continue;
        }

        await processTrade(message);

        await receiver.xAck(STREAM, GROUP, msg.id);
      } catch (error) {
        console.error(
          "candleConsumer failed processing message:",
          msg.id,
          error
        );

        // Don't ACK.
        // Redis will keep the message pending for retry.
      }
    }
  }
}

async function processTrade(message: EngineResponse) {
  const payload =
    typeof message.payload === "string"
      ? JSON.parse(message.payload)
      : message.payload;

  const {
    marketId,
    price,
    qty,
    matchedOrders = [],
  } = payload;

  /*
   * IMPORTANT:
   *
   * Prefer an engine execution timestamp:
   *
   * payload.timestamp
   *
   * Otherwise this currently falls back to the response timestamp.
   */
  const eventTimestamp = Number(
    payload.timestamp ?? message.timestamp
  );

  if (!eventTimestamp) {
    throw new Error("Trade has no timestamp");
  }

  /*
   * One ORDER_FILLED response may contain multiple actual trades.
   *
   * Therefore every matchedOrder represents a trade.
   */
  for (const matchedOrder of matchedOrders) {
    await applyTradeToCandles(
      marketId,
      Number(matchedOrder.price),
      BigInt(matchedOrder.qtyTransfered),
      eventTimestamp
    );
  }

  /*
   * If your engine can produce a filled event without matchedOrders,
   * the main trade itself should also be processed.
   */
  if (matchedOrders.length === 0) {
    await applyTradeToCandles(
      marketId,
      Number(price),
      BigInt(qty),
      eventTimestamp
    );
  }
}

async function applyTradeToCandles(
  marketId: string,
  price: number,
  quantity: bigint,
  timestampMs: number
) {
  for (const [interval, intervalMs] of Object.entries(INTERVALS)) {
    const candleTimestamp =
      Math.floor(timestampMs / intervalMs) * intervalMs;

    const candleTime = new Date(candleTimestamp);

    const existing = await prisma.candle.findUnique({
      where: {
        marketId_interval_timestamp: {
          marketId,
          interval,
          timestamp: candleTime,
        },
      },
    });

    if (!existing) {
      /*
       * No candle exists.
       *
       * Find the previous candle.
       */
      const previous = await prisma.candle.findFirst({
        where: {
          marketId,
          interval,
          timestamp: {
            lt: candleTime,
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      await prisma.candle.create({
        data: {
          marketId,
          interval,
          timestamp: candleTime,

          open: BigInt(price),
          high: BigInt(price),
          low: BigInt(price),
          close: BigInt(price),

          volume: quantity,
          trades: 1n,
        },
      });

      /*
       * If there is a gap between previous candle and this candle,
       * you can later create empty candles using previous.close.
       */
      if (previous) {
        await fillMissingCandles(
          marketId,
          interval,
          intervalMs,
          previous,
          candleTimestamp
        );
      }

      return;
    }

    await prisma.candle.update({
      where: {
        marketId_interval_timestamp: {
          marketId,
          interval,
          timestamp: candleTime,
        },
      },
      data: {
        high:
          BigInt(price) > existing.high
            ? BigInt(price)
            : existing.high,

        low:
          BigInt(price) < existing.low
            ? BigInt(price)
            : existing.low,

        close: BigInt(price),

        volume: {
          increment: quantity,
        },

        trades: {
          increment: 1n,
        },
      },
    });
  }
}

startCandleConsumer();