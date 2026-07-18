/**
 * Reset & Seed Script
 *
 * 1. Flushes Redis (streams, keys, consumer groups)
 * 2. Truncates all PostgreSQL tables
 * 3. Seeds markets into both PostgreSQL AND engine-stream (same UUID)
 * 4. Seeds users into both PostgreSQL AND engine-stream (same UUID)
 * 5. Ramps each user with collateral via engine-stream
 *
 * Usage:   bun run reset
 * Prereq:  Redis + PostgreSQL running (docker-compose up -d)
 */
import { createClient } from 'redis';
import { prisma } from '../packages/db/db.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const client = createClient({ url: REDIS_URL });
await client.connect();

console.log('=== PerpX Reset & Seed ===\n');

// 1. Flush Redis
console.log('Flushing Redis...');
await client.flushAll();
console.log('  Redis flushed\n');

// 2. Clear PostgreSQL
console.log('Clearing PostgreSQL...');
await prisma.$executeRawUnsafe('TRUNCATE TABLE "EngineState" CASCADE');
await prisma.$executeRawUnsafe('TRUNCATE TABLE "Snapshot" CASCADE');
await prisma.$executeRawUnsafe('TRUNCATE TABLE "Transaction" CASCADE');
await prisma.$executeRawUnsafe('TRUNCATE TABLE "Order" CASCADE');
await prisma.$executeRawUnsafe('TRUNCATE TABLE "Market" CASCADE');
await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
console.log('  All tables truncated\n');

// 3. Markets
const markets = [
  {
    marketId: '9fd3ef8c-f147-4076-8e96-d25417881f7e',
    symbol: 'BTC-PERP',
    name: 'BTC-PERP',
    slug: 'btc-perp',
    scale: 1000000n,
    markPrice: 65000000000n,
    mmr: 50n,
    takerRate: 10n,
    makerRate: 5n,
  },
  {
    marketId: 'a665d60d-8592-4cbb-953e-fcb5d58afaa9',
    symbol: 'ETH-PERP',
    name: 'ETH-PERP',
    slug: 'eth-perp',
    scale: 1000000n,
    markPrice: 3500000000n,
    mmr: 50n,
    takerRate: 10n,
    makerRate: 5n,
  },
];

console.log('Seeding markets into PostgreSQL + engine-stream...');
for (const m of markets) {
  await prisma.market.create({
    data: {
      id: m.marketId,
      name: m.name,
      symbol: m.symbol,
      slug: m.slug,
      scale: m.scale,
      markPrice: m.markPrice,
      takerRate: m.takerRate,
      makerRate: m.makerRate,
      mmr: m.mmr,
    },
  });

  await client.xAdd('engine-stream', '*', {
    type: 'CREATE_MARKET',
    corelationId: `seed-mkt-${m.symbol}`,
    payload: JSON.stringify({
      marketId: m.marketId,
      symbol: m.symbol,
      markPrice: m.markPrice.toString(),
      mmr: m.mmr.toString(),
      takerRate: m.takerRate.toString(),
      makerRate: m.makerRate.toString(),
    }),
  });
  console.log(`  ${m.symbol.padEnd(10)} — id:${m.marketId.slice(0, 8)}…`);
}

// 4. Users
const users = [
  { userId: '4d0ba56d-8b19-4bbb-9b56-dd682e3b34ca', username: 'alice', name: 'Alice', password: 'password123', credit: '1000000000000' },
  { userId: 'ace5c514-a92c-4ad9-b677-2742a5c5911e', username: 'bob', name: 'Bob', password: 'password123', credit: '1000000000000' },
];

console.log('\nSeeding users into PostgreSQL + engine-stream...');
for (const u of users) {
  const hashed = await Bun.password.hash(u.password);
  await prisma.user.create({
    data: {
      userId: u.userId,
      username: u.username,
      name: u.name,
      password: hashed,
    },
  });

  await client.xAdd('engine-stream', '*', {
    type: 'CREATE_USER',
    corelationId: `seed-user-${u.username}`,
    payload: JSON.stringify({ userId: u.userId }),
  });
  console.log(`  CREATE_USER — ${u.username.padEnd(8)} (${u.userId.slice(0, 8)}…)`);
}

// 5. Ramp users
console.log('\nRamping users with collateral...');
for (const u of users) {
  await client.xAdd('engine-stream', '*', {
    type: 'RAMP_USER',
    corelationId: `seed-ramp-${u.username}`,
    payload: JSON.stringify({ userId: u.userId, credit: u.credit }),
  });
  console.log(`  RAMP_USER  — ${u.username.padEnd(8)} +${u.credit}`);
}

console.log('\n=== Done ===');
console.log(`  Markets: ${markets.length}`);
console.log(`  Users:   ${users.length}`);
console.log('\nEvents buffered in engine-stream. Restart engine to process.');

await client.quit();
await prisma.$disconnect();
