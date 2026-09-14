import { createClient } from "redis";
import { prisma } from "./lib/db";
import { engineManager } from "./engineManager";
import { Engine } from "@repo/engine-package";

const ENGINE_STREAM = "engine-stream";
const ENGINE_GROUP = "engine-group";
const ENGINE_CONSUMER = "engine";

const RESPONSE_STREAM = "response-stream";
const RESPONSE_GROUP = "response-group";

const SNAPSHOT_INTERVAL = 10 * 60 * 1000;

let snapshotTimer: NodeJS.Timeout;
let shuttingDown = false;

// Authoritative engine checkpoint.
// This always represents the latest stream event incorporated into engine state.
let lastProcessedStreamId = "0-0";

export const sender = createClient({
  url: process.env.REDIS_URL,
});

const receiver = createClient({
  url: process.env.REDIS_URL,
});

sender.on("error", (err) => {
  console.error("[engine sender redis error]", err);
});

receiver.on("error", (err) => {
  console.error("[engine receiver redis error]", err);
});

await sender.connect();
await receiver.connect();

/* ============================================================
 * CONSUMER GROUP
 * ============================================================ */

async function ensureConsumerGroup(
  stream: string,
  group: string,
  startId: string,
) {
  try {
    await receiver.xGroupCreate(stream, group, startId, {
      MKSTREAM: true,
    });

    console.log(
      `[engine] consumer group created | stream=${stream} group=${group}`,
    );
  } catch (error: any) {
    if (
      error?.message?.includes("BUSYGROUP") ||
      error?.message?.includes("Consumer Group name already exists")
    ) {
      console.log(
        `[engine] consumer group already exists | stream=${stream} group=${group}`,
      );

      return;
    }

    throw error;
  }
}

async function initializeFromDatabase() {
  console.log("[engine] no snapshot - initializing from database...");

  Engine.create();

  const users = await prisma.user.findMany();
  const markets = await prisma.market.findMany();

  for (const user of users) {
    engineManager({
      type: "CREATE_USER",
      payload: JSON.stringify({
        userId: user.userId,
      }),
    });
  }

  for (const market of markets) {
    engineManager({
      type: "CREATE_MARKET",
      payload: JSON.stringify({
        marketId: market.id,
        symbol: market.symbol,
        markPrice: market.markPrice.toString(),
        mmr: market.mmr.toString(),
        takerRate: market.takerRate.toString(),
        makerRate: market.makerRate.toString(),
        taxationScale: market.scale.toString(),
      }),
    });
  }

  lastProcessedStreamId = "0-0";

  console.log(
    `[engine] database initialization complete | users=${users.length} markets=${markets.length}`,
  );
}

/* ============================================================
 * RESTORE SNAPSHOT
 * ============================================================ */

async function restoreSnapshot() {
  console.log("[engine] checking for snapshot...");

  const snapshot = await prisma.snapshot.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!snapshot) {
    console.log("[engine] no snapshot found");

    
    await initializeFromDatabase();

    return;
  }

  console.log(
    `[engine] snapshot found | streamId=${snapshot.streamId}`,
  );

  const restoredEngine = Engine.createFromSnapshot(
    snapshot.snapshot,
  );

  if (!restoredEngine) {
    throw new Error(
      "[engine] failed to restore snapshot",
    );
  }

  /*
   * IMPORTANT:
   *
   * Snapshot streamId is the authoritative checkpoint.
   *
   * Everything AFTER this ID must be replayed.
   */
  lastProcessedStreamId = snapshot.streamId;

  console.log(
    `[engine] snapshot restored | checkpoint=${lastProcessedStreamId}`,
  );

  console.log(
    `[engine] engine eventId=${restoredEngine.getLastEventId()}`,
  );
}

/* ============================================================
 * APPLY EVENT TO ENGINE
 *
 * This function ONLY changes engine state.
 *
 * It does NOT publish a response.
 *
 * This is what makes replay safe.
 * ============================================================ */

async function applyEvent(
  streamId: string,
  message: Record<string, string>,
) {
  console.log(
    `[engine] applying event | stream=${streamId} | type=${message.type}`,
  );

  const request = {
    ...message,
  };

  engineManager(request);

  /*
   * The event is now incorporated into engine state.
   *
   * IMPORTANT:
   * We advance the checkpoint only after successful application.
   */
  lastProcessedStreamId = streamId;
}

/* ============================================================
 * PROCESS LIVE EVENT
 *
 * Live events:
 *
 *   apply to engine
 *        ↓
 *   publish response
 *        ↓
 *   ACK Redis message
 *
 * Replay events do NOT come through this function.
 * ============================================================ */

async function processLiveEvent(
  streamId: string,
  message: Record<string, string>,
) {
  console.log(
    `[engine] processing live event | stream=${streamId} | type=${message.type}`,
  );

  const request = {
    ...message,
  };

  const response = engineManager(request);

  /*
   * Commands which don't produce a response.
   */
  if (response === null) {
    lastProcessedStreamId = streamId;

    console.log(
      `[engine] live event processed without response | stream=${streamId}`,
    );

    return;
  }

  const responseDto: Record<string, string> = {
    corelationId: message.corelationId ?? "",
    event: response.event ?? "",
    eventId: response.eventId ?? "",
    payload: JSON.stringify(response.payload),
    timestamp:Date.now().toString()
  };

  console.log(
    "[engine] publishing response:",
    responseDto,
  );

  const responseStreamId = await sender.xAdd(
    RESPONSE_STREAM,
    "*",
    responseDto,
  );

  console.log(
    `[engine] response published | responseStream=${responseStreamId}`,
  );

  /*
   * IMPORTANT:
   *
   * Only mark the event processed after the response
   * was successfully published.
   */
  lastProcessedStreamId = streamId;

  console.log(
    `[engine] live event processed | stream=${streamId}`,
  );
}

/* ============================================================
 * REPLAY EVENTS AFTER SNAPSHOT
 *
 * THIS IS THE CORE RECOVERY MECHANISM.
 *
 * Snapshot:
 *
 *       C
 *       ↓
 * A B C D E F G H I J
 *
 * We replay:
 *
 * D E F G H I J
 *
 * regardless of whether Redis considers them pending.
 *
 * The snapshot checkpoint is the only boundary.
 * ============================================================ */

async function replayFromCheckpoint() {
  console.log(
    `[engine] replaying events after checkpoint=${lastProcessedStreamId}`,
  );

  let replayed = 0;

  while (!shuttingDown) {
    const response = await receiver.xRead(
      {
        key: ENGINE_STREAM,
        id: lastProcessedStreamId,
      },
      {
        COUNT: 100,
      },
    );

    if (!response || response.length === 0) {
      break;
    }

    for (const stream of response) {
      for (const event of stream.messages) {
        /*
         * Apply event to engine state only.
         *
         * DO NOT publish responses during replay.
         */
        await applyEvent(
          event.id,
          event.message,
        );

        replayed++;

        console.log(
          `[engine] replayed event | stream=${event.id}`,
        );
      }
    }
  }

  console.log(
    `[engine] replay complete | replayed=${replayed} | checkpoint=${lastProcessedStreamId}`,
  );
}

/* ============================================================
 * ACK OLD PEL EVENTS
 *
 * Events already delivered to the old consumer may still be
 * present in Redis PEL.
 *
 * After replaying from the authoritative snapshot checkpoint,
 * those events have already been incorporated into engine state.
 *
 * We ACK PEL entries whose IDs are <= checkpoint.
 *
 * This prevents them from being processed again.
 * ============================================================ */

async function acknowledgeRecoveredPel() {
  console.log("[engine] cleaning recovered PEL entries...");

  while (!shuttingDown) {
    const pending = await receiver.xPending(
      ENGINE_STREAM,
      ENGINE_GROUP,
    );

    if (pending.pending === 0) {
      break;
    }

    const response = await receiver.xPending(
      ENGINE_STREAM,
      ENGINE_GROUP,
      "-",
      "+",
      100,
    );

    if (!response || response.length === 0) {
      break;
    }

    let acknowledged = 0;

    for (const entry of response) {
      /*
       * Redis stream IDs are lexicographically ordered by
       * sequence because they have the form:
       *
       * milliseconds-sequence
       *
       * For normal Redis stream IDs, this comparison is safe.
       */
      if (entry.id <= lastProcessedStreamId) {
        await receiver.xAck(
          ENGINE_STREAM,
          ENGINE_GROUP,
          entry.id,
        );

        acknowledged++;

        console.log(
          `[engine] stale PEL entry ACKed | stream=${entry.id}`,
        );
      }
    }

    /*
     * Nothing else can be cleaned right now.
     */
    if (acknowledged === 0) {
      break;
    }
  }

  console.log("[engine] PEL cleanup complete");
}

/* ============================================================
 * LIVE CONSUMPTION
 * ============================================================ */

async function consumeEvents() {
  console.log("[engine] starting live consumer...");

  while (!shuttingDown) {
    try {
      const response = await receiver.xReadGroup(
        ENGINE_GROUP,
        ENGINE_CONSUMER,
        [
          {
            key: ENGINE_STREAM,
            id: ">",
          },
        ],
        {
          BLOCK: 1000,
          COUNT: 100,
        },
      );

      if (!response) {
        continue;
      }

      for (const stream of response) {
        for (const event of stream.messages) {
          try {
            await processLiveEvent(
              event.id,
              event.message,
            );

            await receiver.xAck(
              ENGINE_STREAM,
              ENGINE_GROUP,
              event.id,
            );

            console.log(
              `[engine] event ACKed | stream=${event.id}`,
            );
          } catch (error) {
            console.error(
              `[engine] event processing failed | stream=${event.id}`,
              error,
            );

            /*
             * DO NOT ACK.
             *
             * Redis keeps this event in the PEL.
             *
             * It can therefore be recovered after restart.
             */
          }
        }
      }
    } catch (error) {
      if (shuttingDown) {
        break;
      }

      console.error(
        "[engine] consumer error",
        error,
      );

      break;
    }
  }
}

/* ============================================================
 * CREATE SNAPSHOT
 * ============================================================ */

async function createSnapshot() {
  try {
    const engine = Engine.create();

    /*
     * Snapshot checkpoint MUST correspond to the engine state.
     */
    const streamId = lastProcessedStreamId;

    const snapshot = engine.getSnapshot();

    const parsedSnapshot = JSON.parse(snapshot);

    const response = {
      event: "SNAPSHOT",
      eventId: engine.getLastEventId().toString(),

      payload: {
        snapshot,
        lastEventId: engine.getLastEventId().toString(),
        liquidationCounters:
          engine.getLiquidationCountersForSnapshot(),
        streamId,
        timestamp: Date.now(),
      },
    };

    const responseDto: Record<string, string> = {
      corelationId: "",
      event: response.event,
      eventId: response.eventId,
      payload: JSON.stringify(response.payload),
    };

    console.log(
      `[engine] publishing snapshot | streamId=${streamId} | eventId=${response.eventId}`,
    );

    const responseStreamId = await sender.xAdd(
      RESPONSE_STREAM,
      "*",
      responseDto,
    );

    console.log(
      `[engine] snapshot published | responseStream=${responseStreamId} | checksum=${parsedSnapshot.checksum}`,
    );
  } catch (error) {
    console.error(
      "[engine] snapshot creation/publishing failed",
      error,
    );
  }
}

/* ============================================================
 * SNAPSHOT SCHEDULER
 * ============================================================ */

function startSnapshotScheduler() {
  snapshotTimer = setInterval(
    () => {
      void createSnapshot();
    },
    SNAPSHOT_INTERVAL,
  );

  console.log(
    `[engine] snapshot scheduler started | every ${SNAPSHOT_INTERVAL / 1000}s`,
  );
}

/* ============================================================
 * SHUTDOWN
 * ============================================================ */

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }

  clearInterval(snapshotTimer);

  shuttingDown = true;

  console.log(
    `[engine] shutting down | signal=${signal}`,
  );

  try {
    await createSnapshot();
  } catch (error) {
    console.error(
      "[engine] final snapshot failed",
      error,
    );
  }

  try {
    if (receiver.isOpen) {
      await receiver.quit();
    }
  } catch (error) {
    console.error(
      "[engine] receiver shutdown failed",
      error,
    );
  }

  try {
    if (sender.isOpen) {
      await sender.quit();
    }
  } catch (error) {
    console.error(
      "[engine] sender shutdown failed",
      error,
    );
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error(
      "[engine] prisma shutdown failed",
      error,
    );
  }

  console.log("[engine] shutdown complete");
}

/* ============================================================
 * SIGNALS
 * ============================================================ */

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

/* ============================================================
 * MAIN
 * ============================================================ */

async function main() {
  console.log("====================================");
  console.log("       PERPX ENGINE STARTING");
  console.log("====================================");

  /*
   * 1. Restore latest authoritative checkpoint.
   */
  await restoreSnapshot();

  /*
   * 2. Ensure engine consumer group exists.
   */
  await ensureConsumerGroup(
    ENGINE_STREAM,
    ENGINE_GROUP,
    "0-0",
  );

  /*
   * 3. Ensure response consumer group exists.
   */
  try {
    await sender.xGroupCreate(
      RESPONSE_STREAM,
      RESPONSE_GROUP,
      "$",
      {
        MKSTREAM: true,
      },
    );

    console.log(
      `[engine] response group created | ${RESPONSE_GROUP}`,
    );
  } catch (error: any) {
    if (
      error?.message?.includes("BUSYGROUP") ||
      error?.message?.includes(
        "Consumer Group name already exists",
      )
    ) {
      console.log(
        `[engine] response group already exists | ${RESPONSE_GROUP}`,
      );
    } else {
      throw error;
    }
  }

  /*
   * ==========================================================
   * 4. REPLAY EVERYTHING AFTER SNAPSHOT
   * ==========================================================
   *
   * Snapshot:
   *
   *       C
   *       ↓
   * A B C D E F G H I J
   *
   * Replay:
   *
   *         D E F G H I J
   *
   * We DO NOT ask Redis which events are pending.
   *
   * The snapshot streamId is the authoritative checkpoint.
   */
  await replayFromCheckpoint();

  /*
   * 5. Clean PEL entries which are now already incorporated
   *    into engine state.
   */
  await acknowledgeRecoveredPel();

  /*
   * 6. Start periodic snapshots.
   */
  startSnapshotScheduler();

  /*
   * 7. Now transition to normal live consumption.
   *
   * XREADGROUP ">" receives events that have not yet been
   * delivered to this consumer group.
   */
  await consumeEvents();
}

/* ============================================================
 * BOOT
 * ============================================================ */

main().catch(async (error) => {
  console.error(
    "[engine] fatal error",
    error,
  );

  shuttingDown = true;

  try {
    if (receiver.isOpen) {
      await receiver.quit();
    }
  } catch {}

  try {
    if (sender.isOpen) {
      await sender.quit();
    }
  } catch {}

  try {
    await prisma.$disconnect();
  } catch {}

  process.exit(1);
});
