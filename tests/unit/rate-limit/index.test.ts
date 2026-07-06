import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns allowed: true under the limit", async () => {
    const result = await checkRateLimit("test-under", { windowMs: 60000, maxRequests: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("returns allowed: false over the limit", async () => {
    const key = "test-over";
    const config = { windowMs: 60000, maxRequests: 2 };

    await checkRateLimit(key, config);
    await checkRateLimit(key, config);
    const result = await checkRateLimit(key, config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("different keys have separate counters", async () => {
    const config = { windowMs: 60000, maxRequests: 1 };

    const a1 = await checkRateLimit("key-a", config);
    const b1 = await checkRateLimit("key-b", config);

    expect(a1.allowed).toBe(true);
    expect(b1.allowed).toBe(true);

    const a2 = await checkRateLimit("key-a", config);
    expect(a2.allowed).toBe(false);

    const b2 = await checkRateLimit("key-b", config);
    expect(b2.allowed).toBe(false);
  });

  it("resets after window expires", async () => {
    const key = "test-reset";
    const config = { windowMs: 1000, maxRequests: 1 };

    await checkRateLimit(key, config);
    const blocked = await checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    const afterReset = await checkRateLimit(key, config);
    expect(afterReset.allowed).toBe(true);
  });

  it("uses default config when none provided", async () => {
    const result = await checkRateLimit("test-default");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("tracks remaining correctly", async () => {
    const key = "test-remaining";
    const config = { windowMs: 60000, maxRequests: 3 };

    const r1 = await checkRateLimit(key, config);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(key, config);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit(key, config);
    expect(r3.remaining).toBe(0);
  });
});
