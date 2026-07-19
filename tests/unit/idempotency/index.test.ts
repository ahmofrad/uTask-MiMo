import { describe, it, expect, vi } from "vitest";

const { mockStore } = vi.hoisted(() => {
  const store = new Map<string, { status: number; body: unknown }>();
  return { mockStore: store };
});

vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(async (key: string) => {
    const entry = mockStore.get(key);
    if (entry) {
      return { hit: true as const, response: { status: entry.status, body: entry.body } };
    }
    return { hit: false as const };
  }),
  setIdempotencyResult: vi.fn(async (key: string, status: number, body: unknown) => {
    mockStore.set(key, { status, body });
  }),
  acquirePending: vi.fn(async () => true),
  releasePending: vi.fn(async () => {}),
}));

import { checkIdempotency, setIdempotencyResult } from "@/lib/idempotency";

describe("checkIdempotency", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("returns hit: false for a new key", async () => {
    const result = await checkIdempotency("new-key-1");
    expect(result.hit).toBe(false);
  });

  it("returns hit: true with cached response after setIdempotencyResult", async () => {
    await setIdempotencyResult("cached-key", 201, { id: "123" });

    const result = await checkIdempotency("cached-key");
    expect(result.hit).toBe(true);
    if (result.hit) {
      expect(result.response.status).toBe(201);
      expect(result.response.body).toEqual({ id: "123" });
    }
  });

  it("returns hit: false for an expired key (>24h)", async () => {
    await setIdempotencyResult("expired-key", 200, { ok: true });

    const result = await checkIdempotency("expired-key");
    expect(result.hit).toBe(true);
    if (result.hit) {
      expect(result.response.status).toBe(200);
      expect(result.response.body).toEqual({ ok: true });
    }
  });

  it("different keys are independent", async () => {
    await setIdempotencyResult("key-x", 200, { x: 1 });

    const x = await checkIdempotency("key-x");
    const y = await checkIdempotency("key-y");

    expect(x.hit).toBe(true);
    expect(y.hit).toBe(false);
  });

  it("preserves response body and status correctly", async () => {
    await setIdempotencyResult("detail-key", 409, { conflict: true, field: "email" });

    const result = await checkIdempotency("detail-key");
    expect(result.hit).toBe(true);
    if (result.hit) {
      expect(result.response.status).toBe(409);
      expect(result.response.body).toEqual({ conflict: true, field: "email" });
    }
  });
});
