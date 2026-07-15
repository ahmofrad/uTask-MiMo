import { getRedis } from "@/lib/redis";

const IDEMPOTENCY_TTL = 86400; // 24 hours

export async function checkIdempotency(
  key: string,
): Promise<{ hit: true; response: { status: number; body: unknown } } | { hit: false }> {
  try {
    const redis = await getRedis();
    const raw = await redis.get(`idempotency:${key}`);
    if (raw) {
      const entry = JSON.parse(raw) as { status: number; body: unknown };
      return { hit: true, response: { status: entry.status, body: entry.body } };
    }
  } catch {
    // Redis unavailable — treat as miss
  }
  return { hit: false };
}

export async function setIdempotencyResult(
  key: string,
  status: number,
  body: unknown,
): Promise<void> {
  try {
    const redis = await getRedis();
    const data = JSON.stringify({ status, body });
    await redis.setex(`idempotency:${key}`, IDEMPOTENCY_TTL, data);
    await redis.del(`idempotency-pending:${key}`);
  } catch {
    // Redis unavailable — silently skip
  }
}

export async function acquirePending(key: string): Promise<boolean> {
  try {
    const redis = await getRedis();
    const result = await redis.setnx(`idempotency-pending:${key}`, "1");
    if (result === 1) {
      await redis.expire(`idempotency-pending:${key}`, 30);
      return true;
    }
    return false;
  } catch {
    return true; // If Redis is down, allow the request through
  }
}

export async function releasePending(key: string): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.del(`idempotency-pending:${key}`);
  } catch {
    // Best-effort
  }
}
