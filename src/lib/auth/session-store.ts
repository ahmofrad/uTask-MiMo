import { getRedis } from "@/lib/redis";
import { randomHex } from "@/lib/crypto";

const SESSION_PREFIX = "session:";
const USER_SESSIONS_PREFIX = "user_sessions:";

/** 12 h absolute — session key TTL never exceeds this from creation. */
const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
/** 30 min idle — session considered expired if untouched for this long. */
const IDLE_TTL_MS = 30 * 60 * 1000;

export type SessionData = {
  userId: string;
  email: string;
  role: string | null;
  createdAt: number;
  lastUsedAt: number;
  revoked: boolean;
};

export async function createSession(userId: string, email: string, role: string | null): Promise<string> {
  const redis = await getRedis();
  const sessionId = randomHex(32);
  const now = Date.now();
  const data: SessionData = { userId, email, role, createdAt: now, lastUsedAt: now, revoked: false };

  const ttl = Math.floor(ABSOLUTE_TTL_MS / 1000);
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(data), "EX", ttl);
  await redis.sadd(`${USER_SESSIONS_PREFIX}${userId}`, sessionId);

  return sessionId;
}

/**
 * Looks up a session by id.  Returns `null` when:
 * - the key is missing (expired / never existed)
 * - revoked === true
 * - idle timeout exceeded (30 min since lastUsedAt)
 * - absolute timeout exceeded (12 h since createdAt)
 *
 * On success, updates lastUsedAt and resets the key TTL to the remaining
 * absolute lifetime (sliding extension), capped at ABSOLUTE_TTL_MS.
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const redis = await getRedis();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return null;

  const data = JSON.parse(raw) as SessionData;

  if (data.revoked) return null;

  const now = Date.now();
  const idleMs = now - data.lastUsedAt;
  if (idleMs > IDLE_TTL_MS) return null;

  const absoluteMs = now - data.createdAt;
  if (absoluteMs > ABSOLUTE_TTL_MS) return null;

  // Sliding extension: refresh lastUsedAt and reset key TTL to the
  // remaining absolute lifetime.
  data.lastUsedAt = now;
  const remainingMs = ABSOLUTE_TTL_MS - (now - data.createdAt);
  const remainingSec = Math.max(1, Math.floor(remainingMs / 1000));

  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(data), "EX", remainingSec);

  return data;
}

export async function revokeSession(sessionId: string): Promise<void> {
  const redis = await getRedis();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return;
  const data = JSON.parse(raw) as SessionData;
  data.revoked = true;

  // Keep the revoked record alive for the remaining absolute TTL so
  // subsequent lookups see revoked === true rather than a missing key.
  const remainingMs = ABSOLUTE_TTL_MS - (Date.now() - data.createdAt);
  if (remainingMs <= 0) return;
  const remainingSec = Math.max(1, Math.floor(remainingMs / 1000));

  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(data), "EX", remainingSec);
  await redis.srem(`${USER_SESSIONS_PREFIX}${data.userId}`, sessionId);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const redis = await getRedis();
  const sessionIds = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
  if (sessionIds.length === 0) return;

  const pipeline = redis.multi();
  for (const sessionId of sessionIds) {
    pipeline.get(`${SESSION_PREFIX}${sessionId}`);
  }
  const results = await pipeline.exec();

  if (!results) return;

  const pipeline2 = redis.multi();
  const now = Date.now();
  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i]!;
    const raw = results[i]?.[1] as string | null;
    if (!raw) {
      pipeline2.del(`${SESSION_PREFIX}${sessionId}`);
      continue;
    }
    const data = JSON.parse(raw) as SessionData;
    data.revoked = true;
    const remainingMs = ABSOLUTE_TTL_MS - (now - data.createdAt);
    if (remainingMs <= 0) {
      pipeline2.del(`${SESSION_PREFIX}${sessionId}`);
      continue;
    }
    const remainingSec = Math.max(1, Math.floor(remainingMs / 1000));
    pipeline2.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(data), "EX", remainingSec);
  }
  pipeline2.del(`${USER_SESSIONS_PREFIX}${userId}`);
  await pipeline2.exec();
}