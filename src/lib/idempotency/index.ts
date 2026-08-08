import { getRedis } from "@/lib/redis";
import { sha256 } from "@/lib/crypto";
import { logger } from "@/lib/logging";

const IDEMPOTENCY_TTL = 86400; // 24 hours

export type IdempotencyScope = {
  userId: string;
  route: string;
  bodyHash?: string;
};

export type IdempotencyCheckResult =
  | { hit: true; conflict?: false; unavailable?: false; response: { status: number; body: unknown } }
  | { hit: false; conflict?: boolean; unavailable?: boolean };

export type PendingResult = "acquired" | "in_progress" | "unavailable";

export class IdempotencyUnavailableError extends Error {
  constructor() {
    super("Idempotency storage is unavailable");
    this.name = "IdempotencyUnavailableError";
  }
}

function scopedKey(key: string, scope?: IdempotencyScope): string {
  const material = scope
    ? JSON.stringify({ key, userId: scope.userId, route: scope.route })
    : JSON.stringify({ key, legacy: true });
  return `idempotency:${sha256(material)}`;
}

function pendingKey(key: string, scope?: IdempotencyScope): string {
  return `${scopedKey(key, scope)}:pending`;
}

export async function checkIdempotency(
  key: string,
  scope?: IdempotencyScope,
): Promise<IdempotencyCheckResult> {
  try {
    const redis = await getRedis();
    const raw = await redis.get(scopedKey(key, scope));
    if (raw) {
      const entry = JSON.parse(raw) as { status: number; body: unknown; bodyHash?: string | null };
      if (scope?.bodyHash && entry.bodyHash !== scope.bodyHash) {
        return { hit: false, conflict: true, unavailable: false };
      }
      return { hit: true, response: { status: entry.status, body: entry.body } };
    }
    return { hit: false, unavailable: false };
  } catch (error) {
    logger.error({ error }, "Idempotency storage read failed");
    return { hit: false, unavailable: true };
  }
}

export async function setIdempotencyResult(
  key: string,
  status: number,
  body: unknown,
  scope?: IdempotencyScope,
): Promise<void> {
  try {
    const redis = await getRedis();
    const data = JSON.stringify({ status, body, bodyHash: scope?.bodyHash ?? null });
    await redis.setex(scopedKey(key, scope), IDEMPOTENCY_TTL, data);
    await redis.del(pendingKey(key, scope));
  } catch (error) {
    logger.error({ error }, "Idempotency storage write failed");
    throw new IdempotencyUnavailableError();
  }
}

export async function acquirePending(key: string, scope?: IdempotencyScope): Promise<PendingResult> {
  try {
    const redis = await getRedis();
    const pending = pendingKey(key, scope);
    const result = await redis.setnx(pending, "1");
    if (result === 1) {
      await redis.expire(pending, 30);
      return "acquired";
    }
    return "in_progress";
  } catch (error) {
    logger.error({ error }, "Idempotency pending state failed");
    return "unavailable";
  }
}

export async function releasePending(key: string, scope?: IdempotencyScope): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.del(pendingKey(key, scope));
  } catch (error) {
    // The key has a short TTL; preserve the original request result while
    // making the cleanup failure observable.
    logger.error({ error }, "Idempotency pending cleanup failed");
  }
}
