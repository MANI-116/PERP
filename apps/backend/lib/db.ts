import { createPrismaClient } from "@repo/db";
import { config } from "../config";

const db = createPrismaClient(config.DATABASE_URL);

if(!db) throw new Error("unable to connect to the database");


export const prisma = db;