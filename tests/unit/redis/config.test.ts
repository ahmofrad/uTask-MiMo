import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRedisConnectionOptions } from "@/lib/redis/config";

describe("Redis connection configuration", () => {
  const original = {
    redisUrl: process.env.REDIS_URL,
    sentinels: process.env.REDIS_SENTINELS,
    sentinelName: process.env.REDIS_SENTINEL_NAME,
    redisPassword: process.env.REDIS_PASSWORD,
    sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
  };

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_SENTINELS;
    delete process.env.REDIS_SENTINEL_NAME;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_SENTINEL_PASSWORD;
  });

  afterEach(() => {
    if (original.redisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original.redisUrl;
    if (original.sentinels === undefined) delete process.env.REDIS_SENTINELS;
    else process.env.REDIS_SENTINELS = original.sentinels;
    if (original.sentinelName === undefined) delete process.env.REDIS_SENTINEL_NAME;
    else process.env.REDIS_SENTINEL_NAME = original.sentinelName;
    if (original.redisPassword === undefined) delete process.env.REDIS_PASSWORD;
    else process.env.REDIS_PASSWORD = original.redisPassword;
    if (original.sentinelPassword === undefined) delete process.env.REDIS_SENTINEL_PASSWORD;
    else process.env.REDIS_SENTINEL_PASSWORD = original.sentinelPassword;
  });

  it("uses the direct Redis URL when Sentinel is not configured", () => {
    process.env.REDIS_URL = "redis://redis:6379/2";

    expect(getRedisConnectionOptions()).toBe("redis://redis:6379/2");
  });

  it("builds an ioredis Sentinel connection from all configured sentinels", () => {
    process.env.REDIS_SENTINELS = "redis-sentinel-1:26379, redis-sentinel-2:26379";
    process.env.REDIS_SENTINEL_NAME = "taskapp-primary";
    process.env.REDIS_PASSWORD = "[REDACTED]";
    process.env.REDIS_SENTINEL_PASSWORD = "[REDACTED]";

    expect(getRedisConnectionOptions()).toEqual({
      name: "taskapp-primary",
      sentinels: [
        { host: "redis-sentinel-1", port: 26379 },
        { host: "redis-sentinel-2", port: 26379 },
      ],
      password: "[REDACTED]",
      sentinelPassword: "[REDACTED]",
    });
  });

  it("rejects incomplete Sentinel configuration", () => {
    process.env.REDIS_SENTINELS = "redis-sentinel-1:26379";

    expect(() => getRedisConnectionOptions()).toThrow("REDIS_SENTINEL_NAME");
  });
});
