import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export function createPrisma(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export type Ping = () => Promise<void>;

export function prismaPing(prisma: PrismaClient): Ping {
  return async () => {
    await prisma.$queryRaw`SELECT 1`;
  };
}
