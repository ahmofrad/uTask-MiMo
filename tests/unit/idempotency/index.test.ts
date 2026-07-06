import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkIdempotency, setIdempotencyResult } from "@/lib/idempotency";

describe("checkIdempotency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns hit: false for a new key", () => {
    const result = checkIdempotency("new-key-1");
    expect(result.hit).toBe(false);
  });

  it("returns hit: true with cached response after setIdempotencyResult", () => {
    setIdempotencyResult("cached-key", 201, { id: "123" });

    const result = checkIdempotency("cached-key");
    expect(result.hit).toBe(true);
    if (result.hit) {
      expect(result.response.status).toBe(201);
      expect(result.response.body).toEqual({ id: "123" });
    }
  });

  it("returns hit: false for an expired key (>24h)", () => {
    setIdempotencyResult("expired-key", 200, { ok: true });

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    const result = checkIdempotency("expired-key");
    expect(result.hit).toBe(false);
  });

  it("different keys are independent", () => {
    setIdempotencyResult("key-x", 200, { x: 1 });

    const x = checkIdempotency("key-x");
    const y = checkIdempotency("key-y");

    expect(x.hit).toBe(true);
    expect(y.hit).toBe(false);
  });

  it("preserves response body and status correctly", () => {
    setIdempotencyResult("detail-key", 409, { conflict: true, field: "email" });

    const result = checkIdempotency("detail-key");
    expect(result.hit).toBe(true);
    if (result.hit) {
      expect(result.response.status).toBe(409);
      expect(result.response.body).toEqual({ conflict: true, field: "email" });
    }
  });
});
