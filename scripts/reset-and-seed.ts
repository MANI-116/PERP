import { createClient } from "redis";
import { prisma } from "./db";
import { config } from "../config";

if (config.ENVIRONMENT === "production") {
  throw new Error("❌ RESET IS NOT ALLOWED IN PRODUCTION");
}

async function hashPassword(password: string) {
  return Bun.password.hash(password);
}

const redisUrl = config.REDIS_URL;

const redis =
  config.ENVIRONMENT === "local" ||
  config.ENVIRONMENT === "development"
    ? createClient({ url: redisUrl })
    : createClient({
        url: redisUrl,
        socket: {
          tls: true,
          rejectUnauthorized: false,
        },
      });

redis.on("error", (error) => {
  console.error("[redis] error:", error);
});

await redis.connect();

console.log("=== PerpX Development Reset & Seed ===\n");

try {
  // ------------------------------------------------------------
  // 1. Reset Redis
  // ------------------------------------------------------------

  console.log("1. Flushing Redis...");

  await redis.flushDb();

  console.log("   Redis flushed\n");

  // ------------------------------------------------------------
  // 2. Reset PostgreSQL
  //
  // EngineState and Snapshot are engine-owned runtime/recovery
  // state, so they are cleared but NOT seeded here.
  // ------------------------------------------------------------

  console.log("2. Clearing PostgreSQL...");

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Transaction",
      "Order",
      "Market",
      "User",
      "Snapshot",
      "EngineState"
    RESTART IDENTITY CASCADE;
  `);

  const remainingUsers = await prisma.user.count();
  const remainingMarkets = await prisma.market.count();
  const remainingSnapshots = await prisma.snapshot.count();

  if (
    remainingUsers !== 0 ||
    remainingMarkets !== 0 ||
    remainingSnapshots !== 0
  ) {
    throw new Error(
      `Database reset failed:
users=${remainingUsers}
markets=${remainingMarkets}
snapshots=${remainingSnapshots}`,
    );
  }

  console.log("   PostgreSQL cleared\n");

  // ------------------------------------------------------------
  // 3. Seed Markets
  //
  // These are durable reference data.
  // Engine will load them during bootstrap.
  // ------------------------------------------------------------

  const markets = [
    {
      symbol: "BTCUSDT",
      name: "BTC-PERP",
      slug: "btc-perp",
      scale: 1_000_000n,
      markPrice: 65_000_000_000n,
      mmr: 50n,
      takerRate: 10n,
      makerRate: 5n,
    },
    {
      symbol: "ETHUSDT",
      name: "ETH-PERP",
      slug: "eth-perp",
      scale: 1_000_000n,
      markPrice: 3_500_000_000n,
      mmr: 50n,
      takerRate: 10n,
      makerRate: 5n,
    },
  ];

  console.log("3. Seeding markets...");

  for (const market of markets) {
    const created = await prisma.market.create({
      data: market,
    });

    console.log(
      `   ${created.symbol.padEnd(10)} — ${created.id}`,
    );
  }

  console.log("");

  // ------------------------------------------------------------
  // 4. Seed Users
  //
  // Passwords are hashed exactly like normal signup.
  // ------------------------------------------------------------

  console.log("4. Seeding users...");

  const users = [
    {
      username: "alice",
      name: "Alice",
      password: await hashPassword("password123"),
    },
    {
      username: "bob",
      name: "Bob",
      password: await hashPassword("password123"),
    },
  ];

  const result = await prisma.user.createMany({
    data: users,
  });

  console.log(`   Created ${result.count} users\n`);

  // ------------------------------------------------------------
  // 5. DO NOT create EngineState
  // 6. DO NOT create Snapshot
  // 7. DO NOT publish engine events
  //
  // Engine owns its runtime state.
  // On startup it will:
  //
  //   no Snapshot
  //       ↓
  //   load users + markets from DB
  //       ↓
  //   build runtime state
  //       ↓
  //   create initial Snapshot
  // ------------------------------------------------------------

  console.log("=== Reset Complete ===");
  console.log(`Markets seeded: ${markets.length}`);
  console.log(`Users seeded:   ${result.count}`);
  console.log("");
  console.log("Engine must now be started/restarted.");
  console.log("It will detect that no snapshot exists.");
  console.log("It will bootstrap from PostgreSQL.");
  console.log("It will then create the initial snapshot.");

} catch (error) {
  console.error("\n❌ RESET FAILED");
  console.error(error);
  process.exitCode = 1;
} finally {
  await redis.quit();
}

