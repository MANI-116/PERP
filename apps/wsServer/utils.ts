async function consumeCandleEvents() {
    while (true) {
        try {
            const response =
                await candleReceiver.xReadGroup(
                    "websocketserver-candles",
                    "ws-candle-1",
                    [
                        {
                            key: "candle-stream",
                            id: ">",
                        },
                    ],
                    {
                        BLOCK: 10000,
                        COUNT: 100,
                    }
                );

            if (!response) continue;

            const stream = response[0];

            if (!stream) continue;

            for (const streamMsg of stream.messages) {
                const { id, message } = streamMsg;

                try {
                    const raw = message.data;

                    if (!raw) {
                        await candleReceiver.xAck(
                            "candle-stream",
                            "websocketserver-candles",
                            id
                        );

                        continue;
                    }

                    const candle = JSON.parse(raw);

                    const { marketId } = candle;

                    if (!marketId) {
                        console.log(
                            "candle missing marketId"
                        );

                        await candleReceiver.xAck(
                            "candle-stream",
                            "websocketserver-candles",
                            id
                        );

                        continue;
                    }

                    const subs =
                        subscribers.get(marketId);

                    if (!subs || subs.size === 0) {
                        await candleReceiver.xAck(
                            "candle-stream",
                            "websocketserver-candles",
                            id
                        );

                        continue;
                    }

                    /*
                     * Send the COMPLETE current candle.
                     */

                    const wsMessage = JSON.stringify({
                        type: "candle",
                        data: candle,
                    });

                    for (const subscriber of subs) {
                        if (
                            subscriber.readyState ===
                            WebSocket.OPEN
                        ) {
                            subscriber.send(wsMessage);
                        }
                    }

                    await candleReceiver.xAck(
                        "candle-stream",
                        "websocketserver-candles",
                        id
                    );

                } catch (error) {
                    console.error(
                        "[ws-candle] failed processing candle",
                        error
                    );

                    /*
                     * Don't ACK failed messages.
                     * Redis keeps them pending.
                     */
                }
            }

        } catch (error) {
            console.error(
                "[ws-candle] stream error",
                error
            );

            await new Promise(
                resolve => setTimeout(resolve, 1000)
            );
        }
    }
}