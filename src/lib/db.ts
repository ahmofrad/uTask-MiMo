import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logging";
import { recordDbQuery } from "@/lib/metrics";

function createPrismaClient() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost:5432/taskapp");
  url.searchParams.set("statement_timeout", "30000");
  const client = new PrismaClient({
    datasourceUrl: url.toString(),
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "info" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

  client.$on("query", (e) => {
    recordDbQuery(e.duration, e.query);
    if (process.env.NODE_ENV === "development") {
      logger.debug({ query: e.query, params: e.params, duration: e.duration }, "prisma:query");
    }
  });

  client.$on("info", (e) => {
    logger.info(e, "prisma:info");
  });

  client.$on("warn", (e) => {
    logger.warn(e, "prisma:warn");
  });

  client.$on("error", (e) => {
    logger.error(e, "prisma:error");
  });

  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
