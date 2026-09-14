import { createClient, type RedisClientType } from "redis";
import { WebSocket } from "ws";
import { config } from "./config.js";

type Subscribers = Map<string, Set<WebSocket>>;

interface RedisResponse {
    name: string;
    messages: {
        id: string;
        message: {
            [key: string]: string;
        };
    }[];
}

interface Candle {
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

interface CandleConsumerOptions {
    subscribers: Subscribers;
}

/*
 * ---------------------------------------------------------
 * Configuration
 * ---------------------------------------------------------
 */

const CANDLE_STREAM =
    "candle-live-stream";

const CANDLE_CONSUMER_GROUP =
    "websocketserver-candles";

const CANDLE_CONSUMER_NAME =
    `ws-candle-${process.pid}`;

/*
 * ---------------------------------------------------------
 * Redis
 * ---------------------------------------------------------
 */

function createRedisClient() {
    const redisUrl = config.REDIS_URL;

    return config.ENVIRONMENT === "local" ||
        config.ENVIRONMENT === "development"
        ? createClient({
              url: redisUrl,
          })
        : createClient({
              url: redisUrl,
              socket: {
                  tls: true,
                  rejectUnauthorized: false,
              },
          });
}

/*
 * ---------------------------------------------------------
 * Candle WebSocket Consumer
 * ---------------------------------------------------------
 */

export async function startCandleWebSocketConsumer({
    subscribers,
}: CandleConsumerOptions) {
    const receiver = createRedisClient();

    receiver.on("error", (error) => {
        console.error(
            "[candle-ws][redis]",
            error,
        );
    });

    await receiver.connect();

    /*
     * Create consumer group.
     *
     * "$" means:
     * start consuming new candle events.
     *
     * Existing historical candle events are not
     * pushed to WebSocket clients.
     */
    try {
        await receiver.xGroupCreate(
            CANDLE_STREAM,
            CANDLE_CONSUMER_GROUP,
            "$",
            {
                MKSTREAM: true,
            },
        );

        console.log(
            "[candle-ws] consumer group created",
        );
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes(
                "BUSYGROUP",
            )
        ) {
            console.log(
                "[candle-ws] consumer group already exists",
            );
        } else {
            throw error;
        }
    }

    console.log(
        "[candle-ws] listening to",
        CANDLE_STREAM,
    );

    /*
     * Start consuming independently.
     */
    void consumeCandles(
        receiver,
        subscribers,
    );

    /*
     * Return shutdown function so main WS server
     * can close this consumer gracefully.
     */
    return async () => {
        console.log(
            "[candle-ws] shutting down",
        );

        try {
            await receiver.quit();
        } catch (error) {
            console.error(
                "[candle-ws] redis shutdown error",
                error,
            );
        }
    };
}

/*
 * ---------------------------------------------------------
 * Consume Candle Stream
 * ---------------------------------------------------------
 */

async function consumeCandles(
    receiver: RedisClientType,
    subscribers: Subscribers,
) {
    while (true) {
        try {
            const response =
                (await receiver.xReadGroup(
                    CANDLE_CONSUMER_GROUP,
                    CANDLE_CONSUMER_NAME,
                    [
                        {
                            key: CANDLE_STREAM,
                            id: ">",
                        },
                    ],
                    {
                        BLOCK: 10_000,
                        COUNT: 100,
                    },
                )) as RedisResponse[] | null;

            if (!response) {
                continue;
            }

            const stream = response[0];

            if (!stream) {
                continue;
            }

            for (const streamMessage of stream.messages) {
                await processCandleMessage(
                    receiver,
                    streamMessage.id,
                    streamMessage.message,
                    subscribers,
                );
            }
        } catch (error) {
            console.error(
                "[candle-ws] stream consumer error",
                error,
            );

            /*
             * Don't spin aggressively if Redis temporarily
             * becomes unavailable.
             */
            await Bun.sleep(1000);
        }
    }
}

/*
 * ---------------------------------------------------------
 * Process Individual Candle
 * ---------------------------------------------------------
 */

async function processCandleMessage(
    receiver: RedisClientType,
    streamMessageId: string,
    message: {
        [key: string]: string;
    },
    subscribers: Subscribers,
) {
    try {
        /*
         * Candle Aggregator publishes:
         *
         * {
         *   data: JSON.stringify(candle)
         * }
         */
        const rawCandle =
            message.data;

        if (!rawCandle) {
            console.error(
                "[candle-ws] candle message missing data",
            );

            await acknowledge(
                receiver,
                streamMessageId,
            );

            return;
        }

        const candle =
            JSON.parse(
                rawCandle,
            ) as Candle;

        /*
         * Validate the minimum required fields.
         */
        if (
            !candle.marketId ||
            !candle.interval ||
            candle.timestamp === undefined ||
            candle.open === undefined ||
            candle.high === undefined ||
            candle.low === undefined ||
            candle.close === undefined ||
            candle.volume === undefined
        ) {
            console.error(
                "[candle-ws] invalid candle",
                candle,
            );

            await acknowledge(
                receiver,
                streamMessageId,
            );

            return;
        }

        /*
         * Find clients subscribed to this market.
         */
        const marketSubscribers =
            subscribers.get(
                candle.marketId,
            );

        /*
         * No clients currently interested in this market.
         *
         * Still ACK the Redis message because the WS
         * server doesn't need to retain it for future clients.
         *
         * Historical candles come through REST.
         */
        if (
            !marketSubscribers ||
            marketSubscribers.size === 0
        ) {
            await acknowledge(
                receiver,
                streamMessageId,
            );

            return;
        }

        /*
         * Send the COMPLETE candle.
         *
         * Frontend receives:
         *
         * open
         * high
         * low
         * close
         * volume
         * timestamp
         *
         * It does NOT receive a partial OHLC update.
         */
        const wsPayload =
            JSON.stringify({
                type: "candle",
                data: candle,
            });

        /*
         * Don't let one broken/slow socket prevent
         * other subscribers from receiving updates.
         */
        for (
            const subscriber of marketSubscribers
        ) {
            if (
                subscriber.readyState !==
                WebSocket.OPEN
            ) {
                continue;
            }

            try {
                subscriber.send(
                    wsPayload,
                );
            } catch (error) {
                console.error(
                    "[candle-ws] failed sending candle",
                    error,
                );
            }
        }

        /*
         * ACK only after processing the candle.
         */
        await acknowledge(
            receiver,
            streamMessageId,
        );
    } catch (error) {
        /*
         * IMPORTANT:
         *
         * Don't ACK if processing failed.
         *
         * Redis keeps the message pending and it can
         * be recovered later.
         */
        console.error(
            "[candle-ws] failed processing candle message",
            {
                streamMessageId,
                error,
            },
        );
    }
}

/*
 * ---------------------------------------------------------
 * ACK
 * ---------------------------------------------------------
 */

async function acknowledge(
    receiver: RedisClientType,
    streamMessageId: string,
) {
    await receiver.xAck(
        CANDLE_STREAM,
        CANDLE_CONSUMER_GROUP,
        streamMessageId,
    );
}