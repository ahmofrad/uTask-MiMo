import { logger } from "@/lib/logging";
import type IORedis from "ioredis";
import { getRedisConnectionOptions } from "@/lib/redis/config";

let client: IORedis | null = null;
let connecting: Promise<IORedis> | null = null;

export function getRedis(): Promise<IORedis> {
  if (client) return Promise.resolve(client);
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const { default: Redis } = await import(/* webpackIgnore: true */ "ioredis");
      const options = {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 3) {
            logger.error("Redis connection failed after 3 retries");
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      };
      const connection = getRedisConnectionOptions();
      const instance =
        typeof connection === "string"
          ? new Redis(connection, options)
          : new Redis({ ...connection, ...options });

      instance.on("error", (err: Error) => {
        logger.error({ err }, "Redis connection error");
      });

      await instance.connect();
      client = instance;
      return instance;
    } catch (err) {
      logger.error({ err }, "Failed to connect to Redis");
      client = null;
      connecting = null;
      throw err;
    }
  })();

  return connecting;
}
