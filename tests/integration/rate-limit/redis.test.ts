import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import { execSync } from "node:child_process";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let redis: Redis;

beforeAll(async () => {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  await redis.ping();
  // Clear any existing rate limit keys
  const keys = await redis.keys("rl:*");
  if (keys.length > 0) await redis.del(...keys);
});

afterAll(async () => {
  const keys = await redis.keys("rl:*");
  if (keys.length > 0) await redis.del(...keys);
  redis.disconnect();
});

describe("rate limiter integration", () => {
  beforeEach(async () => {
    const keys = await redis.keys("rl:*");
    if (keys.length > 0) await redis.del(...keys);
  });

  it("sliding window counts requests within window", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");

    const key = `test-ip-${Date.now()}`;
    const result = await checkRateLimit(key, { windowMs: 60_000, maxRequests: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("blocks after exceeding maxRequests", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");

    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, { windowMs: 60_000, maxRequests: 5 });
    }
    const result = await checkRateLimit(key, { windowMs: 60_000, maxRequests: 5 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("formatHeaders returns correct header values", async () => {
    const { checkRateLimit, formatHeaders } = await import("@/lib/rate-limit");

    const key = `test-headers-${Date.now()}`;
    const result = await checkRateLimit(key, { windowMs: 60_000, maxRequests: 10 });
    const headers = formatHeaders(result);

    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("9");
    expect(Number(headers["X-RateLimit-Reset"])).toBeGreaterThan(0);
  });

  it("different keys are independent", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");

    const key1 = `test-a-${Date.now()}`;
    const key2 = `test-b-${Date.now()}`;
    await checkRateLimit(key1, { windowMs: 60_000, maxRequests: 1 });
    const r1 = await checkRateLimit(key1, { windowMs: 60_000, maxRequests: 1 });
    expect(r1.allowed).toBe(false);
    const r2 = await checkRateLimit(key2, { windowMs: 60_000, maxRequests: 1 });
    expect(r2.allowed).toBe(true);
  });

  it("ip tier uses 100 requests per minute", async () => {
    const { checkRateLimitIp } = await import("@/lib/rate-limit");

    const ip = "127.0.0.1";
    const result = await checkRateLimitIp(ip);
    expect(result.limit).toBe(100);
  });

  it("user tier uses 300 requests per minute", async () => {
    const { checkRateLimitUser } = await import("@/lib/rate-limit");

    const result = await checkRateLimitUser("user-123");
    expect(result.limit).toBe(300);
  });

  it("token tier uses 1000 requests per minute", async () => {
    const { checkRateLimitToken } = await import("@/lib/rate-limit");

    const result = await checkRateLimitToken("token-456");
    expect(result.limit).toBe(1000);
  });
});
