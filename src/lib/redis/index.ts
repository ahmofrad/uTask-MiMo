import { logger } from "@/lib/logging";
import type IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let client: IORedis | null = null;
let connecting: Promise<IORedis> | null = null;

export function getRedis(): Promise<IORedis> {
  if (client) return Promise.resolve(client);
  if (connecting) return connecting;

  connecting = (async () => {
    const { default: Redis } = await import(/* webpackIgnore: true */ "ioredis");
    const instance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) {
          logger.error("Redis connection failed after 3 retries");
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    instance.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });

    try {
      await instance.connect();
    } catch (err) {
      logger.error({ err }, "Failed to connect to Redis");
      client = null;
      connecting = null;
      throw err;
    }

    client = instance;
    connecting = null;
    return instance;
  })();

  return connecting;
}
