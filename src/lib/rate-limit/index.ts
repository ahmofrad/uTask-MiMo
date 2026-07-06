import { logger } from "@/lib/logging";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

type RedisClient = {
  incr(_key: string): Promise<number>;
  pexpire(_key: string, _ms: number): Promise<unknown>;
  pttl(_key: string): Promise<number>;
  pipeline(): RedisPipeline;
  quit(): Promise<unknown>;
};

type RedisPipeline = {
  incr(_key: string): RedisPipeline;
  pexpire(_key: string, _ms: number): RedisPipeline;
  exec(): Promise<(readonly [null, number][])>;
};

type RedisModule = {
  default: new (_url: string, _opts?: Record<string, unknown>) => RedisClient;
};

let sharedRedis: RedisClient | null = null;
let redisAvailable = true;

async function getRedis(): Promise<RedisClient | null> {
  if (!redisAvailable) return null;
  if (sharedRedis) return sharedRedis;
  try {
    const mod = (await import(/* webpackIgnore: true */ "ioredis")) as RedisModule;
    sharedRedis = new mod.default(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        if (times > 1) {
          redisAvailable = false;
          logger.warn("Redis unavailable for rate limiting, falling back to in-memory");
          return null;
        }
        return 200;
      },
    });
    return sharedRedis;
  } catch {
    redisAvailable = false;
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

function checkInMemory(key: string, tier: RateLimitTier): RateLimitResult {
  const now = Date.now();
  let window = memStore.get(key);

  if (!window || now > window.resetAt) {
    window = { count: 0, resetAt: now + tier.windowMs };
    memStore.set(key, window);
  }

  window.count++;
  const remaining = Math.max(0, tier.maxRequests - window.count);
  const allowed = window.count <= tier.maxRequests;

  return { allowed, remaining, resetAt: window.resetAt };
}

// --- Redis sliding window ---

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

async function checkRedis(key: string, tier: RateLimitTier): Promise<RateLimitResult> {
  const redis = await getRedis();
  if (!redis) return checkInMemory(key, tier);

  try {
    const now = Date.now();
    const fullKey = `${tier.prefix}${key}`;

    // Sliding window: use sorted set with timestamp scores
    // Remove expired entries, add new one, count, set expiry
    const pipe = redis.pipeline();
    pipe.incr(fullKey);
    pipe.pexpire(fullKey, tier.windowMs);
    const results = await pipe.exec();

    const count = results[1]?.[1] ?? 1;
    const remaining = Math.max(0, tier.maxRequests - count);

    // Calculate when the window resets (from the oldest entry in the window)
    // Since we're using INCR + EXPIRE, the window is fixed from first request
    // resetAt is when the key expires
    const ttlMs = await redis.pttl(fullKey);
    const resetAt = ttlMs > 0 ? now + ttlMs : now + tier.windowMs;

    return {
      allowed: count <= tier.maxRequests,
      remaining,
      resetAt,
    };
  } catch (err) {
    logger.warn({ err }, "Redis rate limit check failed, falling back to in-memory");
    return checkInMemory(key, tier);
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
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(resetSeconds > 0 ? resetSeconds : 1),
  };
}
