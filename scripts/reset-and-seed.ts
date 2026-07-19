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
// Flush the currently selected DB
await client.flushDb();

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
    symbol: 'BTC-PERP',
    name: 'BTC-PERP',
    slug: 'btc-perp',
    scale: '1000000',
    markPrice: '65000000000',
    mmr: '50',
    takerRate: '10',
    makerRate: '5',
  },
  {
    symbol: 'ETH-PERP',
    name: 'ETH-PERP',
    slug: 'eth-perp',
    scale: '1000000',
    markPrice: '3500000000',
    mmr: '50',
    takerRate: '10',
    makerRate: '5',
  },
];

console.log('Seeding markets into PostgreSQL + engine-stream...');
for (const m of markets) {
  try {
    const res = await fetch('http://localhost:3001/admin/market', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(m),
  });
  if (!res.ok) {
    console.error(`  Failed to create market ${m.symbol}: ${await res.text()}`);
    continue;
  }
  const { id: marketId } = (await res.json()) as { id: string };

  console.log(`  ${m.symbol.padEnd(10)} — id:${marketId.slice(0, 8)}…`);  
  } catch (error) {
    console.log("error- occured-",error);
    
  }
  
}

// 4. Users
const users = [
  {
    username: 'alice',
    name: 'Alice',
    password: 'password123',
  
  },
  {
    username: 'bob',
    name: 'Bob',
    password: 'password123',

  },
];

console.log('\nSeeding users into PostgreSQL + engine-stream...');
for (const u of users) {
  try {
    
    const res = await fetch('http://localhost:3001/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: u.name,
        username: u.username,
        password: u.password,
      }),
    });
    if (!res.ok) {
      console.error(
        `  Failed to create user ${u.username}: ${await res.text()}`,
      );
      continue;
    }
    const { userId } = (await res.json()) as { userId: string };
  
    console.log(
      `  CREATE_USER — ${u.username.padEnd(8)} (${userId.slice(0, 8)}…)`,
    );
  } catch (error) {
    console.log("error- while creating the user",error);
    
  }
}

console.log('\nSeeding users into PostgreSQL + engine-stream is done');


console.log('\n=== Done ===');
console.log(`  Markets: ${markets.length}`);
console.log(`  Users:   ${users.length}`);
console.log('\nEvents buffered in engine-stream. Restart engine to process.');

await client.quit();

