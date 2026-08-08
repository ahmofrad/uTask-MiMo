import { logger } from "@/lib/logging";
import { randomUUID } from "node:crypto";
import { waitForRedisReady, type RedisReadyClient } from "@/lib/queue/connection";
import type { RedisOptions } from "ioredis";
import { getRedisConnectionOptions } from "@/lib/redis/config";

const rateLimitBackend = process.env.RATE_LIMIT_BACKEND ?? "redis";
const failClosed = process.env.NODE_ENV === "production" || process.env.RATE_LIMIT_FAIL_CLOSED === "true";

type RedisClient = RedisReadyClient & {
  incr(_key: string): Promise<number>;
  pexpire(_key: string, _ms: number): Promise<unknown>;
  pttl(_key: string): Promise<number>;
  pipeline(): RedisPipeline;
  quit(): Promise<unknown>;
  disconnect(): void;
};

type RedisPipeline = {
  zremrangebyscore(_key: string, _min: number, _max: number): RedisPipeline;
  zadd(_key: string, _score: number, _member: string): RedisPipeline;
  zcard(_key: string): RedisPipeline;
  pexpire(_key: string, _ms: number): RedisPipeline;
  exec(): Promise<(readonly [null, number][])>;
};

type RedisModule = {
  default: new (_options: string | RedisOptions, _opts?: Record<string, unknown>) => RedisClient;
};

let sharedRedis: RedisClient | null = null;
let redisAvailable = true;
let redisRetryAt = 0;
let lastRedisWarningAt = 0;

function markRedisUnavailable(err?: unknown) {
  const now = Date.now();
  redisAvailable = false;
  redisRetryAt = now + 10_000;
  if (now - lastRedisWarningAt >= 10_000) {
    lastRedisWarningAt = now;
    logger.warn({ err }, "Redis unavailable for rate limiting, falling back to in-memory");
  }
}

async function getRedis(): Promise<RedisClient | null> {
  if (rateLimitBackend === "memory") return null;
  if (!redisAvailable) {
    if (Date.now() < redisRetryAt) return null;
    redisAvailable = true;
  }
  if (sharedRedis) return sharedRedis;
  let redis: RedisClient | null = null;
  try {
    const mod = (await import(/* webpackIgnore: true */ "ioredis")) as RedisModule;
    redis = new mod.default(getRedisConnectionOptions(), {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        if (times > 1) {
          markRedisUnavailable();
          return null;
        }
        return 200;
      },
    });
    await waitForRedisReady(redis);
    sharedRedis = redis;
    return sharedRedis;
  } catch (err) {
    redis?.disconnect();
    sharedRedis = null;
    markRedisUnavailable(err);
    return null;
  }
}

// --- Rate limit tiers ---

export type RateLimitTier = {
  /** Redis key prefix */
  prefix: string;
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in ms */
  windowMs: number;
};

export const TIERS = {
  ip: { prefix: "rl:ip:", maxRequests: 100, windowMs: 60_000 },
  user: { prefix: "rl:user:", maxRequests: 300, windowMs: 60_000 },
  token: { prefix: "rl:token:", maxRequests: 1000, windowMs: 60_000 },
} as const;

// --- In-memory fallback ---

type Window = { count: number; resetAt: number };
const memStore = new Map<string, Window>();
const MAX_MEM_STORE_SIZE = 100_000;

function cleanupMemStore() {
  const now = Date.now();
  for (const [key, win] of memStore) {
    if (now > win.resetAt) memStore.delete(key);
  }
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupMemStore, 300_000);
}

function evictOldest() {
  // Delete the entry with the oldest resetAt to make room
  let oldestKey: string | null = null;
  let oldestReset = Infinity;
  for (const [key, win] of memStore) {
    if (win.resetAt < oldestReset) {
      oldestReset = win.resetAt;
      oldestKey = key;
    }
  }
  if (oldestKey) memStore.delete(oldestKey);
}

function checkInMemory(key: string, tier: RateLimitTier): RateLimitResult {
  const now = Date.now();
  let window = memStore.get(key);

  if (!window || now > window.resetAt) {
    // Evict if at capacity
    if (memStore.size >= MAX_MEM_STORE_SIZE) evictOldest();
    window = { count: 0, resetAt: now + tier.windowMs };
    memStore.set(key, window);
  }

  window.count++;
  const remaining = Math.max(0, tier.maxRequests - window.count);
  const allowed = window.count <= tier.maxRequests;

  return { allowed, remaining, resetAt: window.resetAt, limit: tier.maxRequests };
}

function redisUnavailableResult(tier: RateLimitTier): RateLimitResult {
  return { allowed: false, remaining: 0, resetAt: Date.now() + 10_000, limit: tier.maxRequests };
}

// --- Redis sliding window ---

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

async function checkRedis(key: string, tier: RateLimitTier): Promise<RateLimitResult> {
  const redis = await getRedis();
  if (!redis) return failClosed ? redisUnavailableResult(tier) : checkInMemory(key, tier);

  try {
    const now = Date.now();
    const fullKey = `${tier.prefix}${key}`;

    // Sliding window: use a sorted set with timestamp scores.
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(fullKey, 0, now - tier.windowMs);
    pipe.zadd(fullKey, now, `${now}:${randomUUID()}`);
    pipe.zcard(fullKey);
    pipe.pexpire(fullKey, tier.windowMs);
    const results = await pipe.exec();

    const count = results[2]?.[1] ?? 1;
    const remaining = Math.max(0, tier.maxRequests - count);

    const ttlMs = await redis.pttl(fullKey);
    const resetAt = ttlMs > 0 ? now + ttlMs : now + tier.windowMs;

    return {
      allowed: count <= tier.maxRequests,
      remaining,
      resetAt,
      limit: tier.maxRequests,
    };
  } catch (err) {
    markRedisUnavailable(err);
    return failClosed ? redisUnavailableResult(tier) : checkInMemory(key, tier);
  }
}

// --- Public API ---

export type { RateLimitResult };

/** Generic check with custom key and config. Uses Redis with in-memory fallback. */
export async function checkRateLimit(
  key: string,
  config: { windowMs: number; maxRequests: number } = { windowMs: 60_000, maxRequests: 60 },
): Promise<RateLimitResult> {
  const tier: RateLimitTier = { prefix: "rl:custom:", ...config };
  return checkRedis(key, tier);
}

export async function checkRateLimitIp(ip: string): Promise<RateLimitResult> {
  return checkRedis(ip, TIERS.ip);
}

export async function checkRateLimitUser(userId: string): Promise<RateLimitResult> {
  return checkRedis(userId, TIERS.user);
}

export async function checkRateLimitToken(tokenId: string): Promise<RateLimitResult> {
  return checkRedis(tokenId, TIERS.token);
}

export function formatHeaders(result: RateLimitResult): Record<string, string> {
  const resetSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(resetSeconds > 0 ? resetSeconds : 1),
  };
}
