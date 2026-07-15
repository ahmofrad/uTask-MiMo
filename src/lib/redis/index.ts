import { logger } from "@/lib/logging";
import type IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let client: IORedis | null = null;

export async function getRedis(): Promise<IORedis> {
  if (client) return client;

  const { default: Redis } = await import(/* webpackIgnore: true */ "ioredis");
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy(times: number) {
      if (times > 3) {
        logger.error("Redis connection failed after 3 retries");
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  client.on("error", (err: Error) => {
    logger.error({ err }, "Redis connection error");
  });

  await client.connect().catch((err: Error) => {
    logger.error({ err }, "Failed to connect to Redis");
    client = null;
  });

  return client!;
}