import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";



export function createPrismaClient(url:string){
  console.log("from prsima package-",url)

  try {
    const adapter = new PrismaPg({
        connectionString: url,
      });
      const prisma = new PrismaClient({
        adapter,
      });

      return prisma;

  } catch (error) {
    console.log("error in prisma",error);
    return null
    
  }
}