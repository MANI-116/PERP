import { createClient } from "redis";
import { prisma } from "@repo/db";

function genId() {
  return `seed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const redisUrl = process.env.REDIS_URL ?? undefined;
const sender = createClient(redisUrl ? { url: redisUrl, socket: { tls: true, rejectUnauthorized: false } } : undefined);
await sender.connect();

// Read markets from DB
const markets = await prisma.market.findMany();
console.log(`Found ${markets.length} markets in DB.`);

// Read users from DB
const users = await prisma.user.findMany();
console.log(`Found ${users.length} users in DB.`);

// Feed markets to engine — marketId is the Prisma UUID (primary key),
// same as what admin.ts handler sends: { marketId: response.id }
for (const market of markets) {
  const corelationId = genId();
  await sender.xAdd("engine-stream", "*", {
    corelationId,
    type: "CREATE_MARKET",
    payload: JSON.stringify({ marketId: market.id }),
  });
  console.log(`Sent CREATE_MARKET for ${market.symbol} (id: ${market.id})`);
}

// Feed users to engine
for (const user of users) {
  const corelationId = genId();
  await sender.xAdd("engine-stream", "*", {
    corelationId,
    type: "CREATE_USER",
    payload: JSON.stringify({ userId: user.userId }),
  });
  console.log(`Sent CREATE_USER for ${user.username} (${user.userId})`);
}

console.log("\nDone. Markets and users have been sent to the engine stream.");
await sender.disconnect();
await prisma.$disconnect();
