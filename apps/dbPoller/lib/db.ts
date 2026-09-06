import { createPrismaClient } from "@repo/db";
import { config } from "../config";
const db = await createPrismaClient(config.DATABASE_URL);

if(!db) throw new Error("db not connected");


export const prisma = db;