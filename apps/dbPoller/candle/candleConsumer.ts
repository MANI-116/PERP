import { createClient, type RedisClientType } from "redis";
import { config } from "../config";
import { saveFinalizedCandle } from "./candleWorker";

const CANDLE_STREAM = "candle-finalized-stream";
const CANDLE_GROUP = "dbPoller-candles";
const CONSUMER_NAME = `db-candle-${process.pid}`;

interface RedisMessage {
    id: string;
    message: Record<string, string>;
}

interface RedisStream {
    name: string;
    messages: RedisMessage[];
}

export interface FinalizedCandle {
    marketId: string;
    interval: string;
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    trades: string;
}

function createRedisClient() {
    const redisUrl = config.REDIS_URL;

    return (
        config.ENVIRONMENT === "local" ||
        config.ENVIRONMENT === "development"
    )
        ? createClient({ url: redisUrl })
        : createClient({
              url: redisUrl,
              socket: {
                  tls: true,
                  rejectUnauthorized: false,
              },
          });
}

export async function startCandleConsumer(): Promise<void> {
    const receiver = createRedisClient();

    receiver.on("error", (error) => {
        console.error(
            "dbPoller candle consumer redis error:",
            error
        );
    });

    await receiver.connect();

    try {
        await receiver.xGroupCreate(
            CANDLE_STREAM,
            CANDLE_GROUP,
            "0",
            {
                MKSTREAM: true,
            }
        );

        console.log(
            "dbPoller: created candle consumer group"
        );
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("BUSYGROUP")
        ) {
            console.log(
                "dbPoller: candle consumer group already exists"
            );
        } else {
            throw error;
        }
    }

    console.log(
        `dbPoller: candle consumer started (${CONSUMER_NAME})`
    );

    while (true) {
        try {
            const response = await receiver.xReadGroup(
                CANDLE_GROUP,
                CONSUMER_NAME,
                [
                    {
                        key: CANDLE_STREAM,
                        id: ">",
                    },
                ],
                {
                    BLOCK: 2000,
                    COUNT: 100,
                }
            ) as RedisStream[] | null;

            if (!response) {
                continue;
            }

            const stream = response[0];

            if (!stream) {
                continue;
            }

            for (const message of stream.messages) {
                try {
                    const rawCandle = message.message.data;

                    if (!rawCandle) {
                        console.warn(
                            "dbPoller: candle message missing data",
                            message.id
                        );

                        await receiver.xAck(
                            CANDLE_STREAM,
                            CANDLE_GROUP,
                            message.id
                        );

                        continue;
                    }

                    const candle =
                        JSON.parse(rawCandle) as FinalizedCandle;

                    await saveFinalizedCandle(candle);

                    await receiver.xAck(
                        CANDLE_STREAM,
                        CANDLE_GROUP,
                        message.id
                    );

                    console.log(
                        "dbPoller: candle persisted",
                        {
                            streamId: message.id,
                            marketId: candle.marketId,
                            timestamp: candle.timestamp,
                        }
                    );
                } catch (error) {
                    console.error(
                        "dbPoller: candle processing failed",
                        {
                            streamId: message.id,
                            error,
                        }
                    );

                    /*
                     * IMPORTANT:
                     * Don't ACK failed messages.
                     *
                     * They remain pending in Redis and can
                     * be recovered later.
                     */
                }
            }
        } catch (error) {
            console.error(
                "dbPoller: candle consumer loop error",
                error
            );

            await new Promise((resolve) =>
                setTimeout(resolve, 1000)
            );
        }
    }
}