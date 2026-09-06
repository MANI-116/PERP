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

export const sender = createClient({
  url: process.env.REDIS_URL,
});

const receiver = createClient({
  url: process.env.REDIS_URL,
});

let shuttingDown = false;


let lastProcessedStreamId = "0-0";

/* ============================================================
 * REDIS ERRORS
 * ============================================================ */

sender.on("error", (err) => {
  console.error("[engine sender redis error]", err);
});

receiver.on("error", (err) => {
  console.error("[engine receiver redis error]", err);
});


/* ============================================================
 * REEDIS CONNECTING
 * ============================================================ */

await sender.connect();
await receiver.connect();




/* ============================================================
 * ENSURE CONSUMER GROUP
 * ============================================================ */

async function ensureConsumerGroup(
  stream: string,
  group: string,
  startId: string,
) {
  try {
    await receiver.xGroupCreate(
      stream,
      group,
      startId,
      {
        MKSTREAM: true,
      },
    );

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

    Engine.create();

    lastProcessedStreamId = "0-0";

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

  lastProcessedStreamId = snapshot.streamId;

  console.log(
    `[engine] snapshot restored | streamId=${lastProcessedStreamId}`,
  );

  console.log(
    `[engine] engine eventId=${restoredEngine.getLastEventId()}`,
  );
}

/* ============================================================
 * PROCESS ONE REDIS EVENT
 * ============================================================ */

async function processEvent(
  streamId: string,
  message: Record<string, string>,
) {
  console.log(
    `[engine] processing event | stream=${streamId} | type=${message.type}`,
  );

  const request = {
    ...message,
  };

  const response = engineManager(request);

  /*
   * engineManager() can return null for commands
   * which don't produce a response.
   */
  if (response === null) {
    lastProcessedStreamId = streamId;

    console.log(
      `[engine] event processed without response | stream=${streamId}`,
    );

    return;
  }

  /*
   * IMPORTANT:
   *
   * Backend ResponseManager expects:
   *
   * corelationId
   * event
   * eventId
   * message
   *
   * Therefore DO NOT call this field "payload".
   */

  const responseDto: Record<string, string> = {
    corelationId: message.corelationId ?? "",
    event: response.event ?? "",
    eventId: response.eventId ?? "",
    payload: JSON.stringify(response.payload),
  };

  console.log("[engine] publishing response:", responseDto);

  console.log("[engine] sender state:", {
    isOpen: sender.isOpen,
    isReady: sender.isReady,
  });

  const responseStreamId = await sender.xAdd(
    RESPONSE_STREAM,
    "*",
    responseDto,
  );

  console.log(
    `[engine] response published | responseStream=${responseStreamId}`,
  );

  /*
   * Only checkpoint AFTER successful response publishing.
   */
  lastProcessedStreamId = streamId;

  console.log(
    `[engine] event processed | stream=${streamId}`,
  );
}

/* ============================================================
 * RECOVER PENDING EVENTS
 * ============================================================ */

async function recoverPendingEvents() {
  console.log("[engine] recovering PEL...");

  while (!shuttingDown) {
    const response = await receiver.xReadGroup(
      ENGINE_GROUP,
      ENGINE_CONSUMER,
      [
        {
          key: ENGINE_STREAM,
          id: "0",
        },
      ],
      {
        COUNT: 100,
      },
    );

    if (!response || response.length === 0) {
      break;
    }

    let processedAnything = false;

    for (const stream of response) {
      for (const event of stream.messages) {
        processedAnything = true;

        console.log(
          `[engine] recovering pending event | stream=${event.id} | type=${event.message.type}`,
        );

        try {
          await processEvent(
            event.id,
            event.message,
          );

          await receiver.xAck(
            ENGINE_STREAM,
            ENGINE_GROUP,
            event.id,
          );

          console.log(
            `[engine] pending event ACKed | stream=${event.id}`,
          );
        } catch (error) {
          /*
           * IMPORTANT:
           *
           * Do not kill the entire engine.
           * Leave the message in PEL.
           */
          console.error(
            `[engine] pending event failed | stream=${event.id}`,
            error,
          );
        }
      }
    }

    if (!processedAnything) {
      break;
    }
  }

  console.log("[engine] PEL recovery complete");
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
            await processEvent(
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
             * DO NOT THROW.
             *
             * Message remains in PEL and the
             * consumer continues processing.
             */
          }
        }
      }
    } catch (error) {
      if (shuttingDown) {
        console.log("stutting down: from receiver error;")
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

    const streamId = lastProcessedStreamId;
    const snapshot = engine.getSnapshot();

    // Validate snapshot before publishing
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
      // Snapshot isn't tied to a request.
      corelationId: "",
      event: response.event,
      eventId: response.eventId,
      message: JSON.stringify(response.payload),
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
  clearTimeout(snapshotTimer);

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



  await restoreSnapshot();

  await ensureConsumerGroup(
    ENGINE_STREAM,
    ENGINE_GROUP,
    "0-0",
  );

  /*
   * Response group is only needed if this engine
   * actually consumes response-stream.
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
      error?.message?.includes("Consumer Group name already exists")
    ) {
      console.log(
        `[engine] response group already exists | ${RESPONSE_GROUP}`,
      );
    } else {
      throw error;
    }
  }

  await recoverPendingEvents();

  startSnapshotScheduler();

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