import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

function resolveDatabaseUrl(connectionString?: string): string {
  const databaseUrl = connectionString ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  return databaseUrl;
}

export function createPrismaClient(connectionString?: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: resolveDatabaseUrl(connectionString),
  });

  return new PrismaClient({ adapter });
}

export type DatabaseClient = PrismaClient;
