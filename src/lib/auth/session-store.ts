import { getRedis } from "@/lib/redis";
import { randomHex } from "@/lib/crypto";

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days
const SESSION_PREFIX = "session:";
const USER_SESSIONS_PREFIX = "user_sessions:";

export type SessionData = {
  userId: string;
  email: string;
  role: string | null;
  createdAt: number;
};

export async function createSession(userId: string, email: string, role: string | null): Promise<string> {
  const redis = await getRedis();
  const sessionId = randomHex(32);
  const data: SessionData = { userId, email, role, createdAt: Date.now() };

  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(data), "EX", SESSION_TTL);
  await redis.sadd(`${USER_SESSIONS_PREFIX}${userId}`, sessionId);

  return sessionId;
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const redis = await getRedis();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function revokeSession(sessionId: string): Promise<void> {
  const redis = await getRedis();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return;
  const data = JSON.parse(raw) as SessionData;
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
  await redis.srem(`${USER_SESSIONS_PREFIX}${data.userId}`, sessionId);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const redis = await getRedis();
  const sessionIds = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
  if (sessionIds.length === 0) return;

  const pipeline = redis.multi();
  for (const sessionId of sessionIds) {
    pipeline.del(`${SESSION_PREFIX}${sessionId}`);
  }
  pipeline.del(`${USER_SESSIONS_PREFIX}${userId}`);
  await pipeline.exec();
}