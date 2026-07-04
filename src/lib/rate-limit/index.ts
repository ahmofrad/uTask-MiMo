// In-memory rate limiter (dev/lightweight).
// For production with multiple instances, swap to Redis-based via ioredis.

type Window = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Window>();

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const DEFAULT_CONFIG: RateLimitConfig = { windowMs: 60000, maxRequests: 60 };

export function checkRateLimit(key: string, config: RateLimitConfig = DEFAULT_CONFIG): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  let window = store.get(key);

  if (!window || now > window.resetAt) {
    window = { count: 0, resetAt: now + config.windowMs };
    store.set(key, window);
  }

  window.count++;
  const remaining = Math.max(0, config.maxRequests - window.count);

  if (window.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: window.resetAt };
  }

  return { allowed: true, remaining, resetAt: window.resetAt };
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, win] of store) {
      if (now > win.resetAt) store.delete(key);
    }
  }, 300_000);
}
