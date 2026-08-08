import { randomUUID } from "node:crypto";
import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logging";

type LockRedis = Awaited<ReturnType<typeof getRedis>>;

const RELEASE_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/** Runs work only on the worker that owns the short-lived Redis lock. */
export async function withDistributedLock<T>(
  name: string,
  ttlMs: number,
  work: () => Promise<T>,
): Promise<T | undefined> {
  let redis: LockRedis;
  try {
    redis = await getRedis();
  } catch (err) {
    logger.error({ err, lock: name }, "Scheduler lock unavailable");
    return undefined;
  }

  const key = `taskapp:lock:${name}`;
  const token = randomUUID();
  try {
    const acquired = await redis.set(key, token, "PX", ttlMs, "NX");
    if (acquired !== "OK") return undefined;

    try {
      return await work();
    } finally {
      try {
        await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
      } catch (err) {
        logger.error({ err, lock: name }, "Scheduler lock release failed");
      }
    }
  } catch (err) {
    logger.error({ err, lock: name }, "Scheduler lock operation failed");
    return undefined;
  }
}
