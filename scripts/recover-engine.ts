import { prisma } from "@repo/db";
import { createClient } from "redis";

function generateId() {
  return `rec-${Date.now() + Math.floor(Math.random() * 1e6)}`;
}

async function main() {
  console.log("recovery: fetching latest snapshot from PostgreSQL...");

  const snapshot = await prisma.snapshot.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!snapshot) {
    console.log("recovery: no snapshot found, engine will start fresh");
    process.exit(0);
  }

  console.log("recovery: found snapshot from", snapshot.createdAt, "at streamId", snapshot.streamId);

  const sender = createClient();
  sender.on("error", (error) => {
    console.log("recovery: error on connecting to redis-", error);
  });
  await sender.connect();

  await sender.xAdd("engine-stream", "*", {
    type: "RESTORE_SNAPSHOT",
    corelationId: generateId(),
    payload: JSON.stringify({
      snapshot: snapshot.snapshot,
      lastEventId: snapshot.lastEventId.toString(),
      liquidationCounters: snapshot.liquidationCounters as Record<string, string>,
    }),
  });

  console.log("recovery: RESTORE_SNAPSHOT sent to engine-stream");
  console.log("recovery: start the engine process to load the restored state");
  
  await sender.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.log("recovery: error-", error);
  process.exit(1);
});
