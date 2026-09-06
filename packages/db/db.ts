import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dns from "node:dns/promises";

async function resolveIPv4Host(hostname: string): Promise<string> {
  const addresses = await dns.resolve4(hostname);
  if (!addresses.length) throw new Error(`No IPv4 address found for ${hostname}`);
  return addresses[0];
}

async function waitForConnection(pool: Pool, attempts = 8, delayMs = 2000) {
  for (let i = 0; i < attempts; i++) {
    let client;
    try {
      client = await pool.connect();
      await client.query("SELECT 1");
      console.log(`[db] connected on attempt ${i + 1}`);
      return;
    } catch (error) {
      console.log(`[db] connection attempt ${i + 1} failed:`, (error as Error).message);
      if (i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, delayMs));
    } finally {
      client?.release();
    }
  }
}

export async function createPrismaClient(url: string) {
  console.log("from prisma package-", url);

  const parsed = new URL(url);
  const originalHost = parsed.hostname;
  const ipv4Host = await resolveIPv4Host(originalHost);
  console.log(`[db] resolved ${originalHost} -> ${ipv4Host} (forcing IPv4)`);

  const pool = new Pool({
    host: ipv4Host,                                   // connect via raw IPv4
    port: parsed.port ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    connectionTimeoutMillis: 15_000,
    ssl: {
      servername: originalHost,                       // correct SNI for TLS handshake
      rejectUnauthorized: true,
    },
  });

  try {
    await waitForConnection(pool);
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    return prisma;
  } catch (error) {
    console.log("error in prisma", error);
    return null;
  }
}