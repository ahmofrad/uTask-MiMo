import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, redis } = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    store: values,
    redis: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      setex: vi.fn(async (key: string, _ttl: number, value: string) => { values.set(key, value); }),
      del: vi.fn(async (key: string) => { values.delete(key); }),
      setnx: vi.fn(async () => 1),
      expire: vi.fn(async () => 1),
    },
  };
});

vi.mock("@/lib/redis", () => ({ getRedis: vi.fn(async () => redis) }));

import { acquirePending, checkIdempotency, setIdempotencyResult } from "@/lib/idempotency";

describe("scoped idempotency keys", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("does not share a key between users or routes", async () => {
    const first = { userId: "user-1", route: "tasks:create" };
    const second = { userId: "user-2", route: "tasks:create" };

    await setIdempotencyResult("same-key", 201, { id: "task-1" }, first);

    await expect(checkIdempotency("same-key", first)).resolves.toMatchObject({ hit: true });
    await expect(checkIdempotency("same-key", second)).resolves.toMatchObject({ hit: false });
    await expect(checkIdempotency("same-key", { userId: "user-1", route: "comments:create" })).resolves.toMatchObject({ hit: false });
  });

  it("rejects reuse with a different request body", async () => {
    const first = { userId: "user-1", route: "tasks:create", bodyHash: "hash-a" };
    const second = { userId: "user-1", route: "tasks:create", bodyHash: "hash-b" };

    await setIdempotencyResult("same-body-key", 201, { id: "task-1" }, first);

    await expect(checkIdempotency("same-body-key", first)).resolves.toMatchObject({ hit: true });
    await expect(checkIdempotency("same-body-key", second)).resolves.toMatchObject({ hit: false, conflict: true });
  });

  it("distinguishes an existing pending request from a newly acquired one", async () => {
    const scope = { userId: "user-1", route: "tasks:create" };
    redis.setnx.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await expect(acquirePending("pending-key", scope)).resolves.toBe("acquired");
    await expect(acquirePending("pending-key", scope)).resolves.toBe("in_progress");
  });

  it("fails closed when Redis is unavailable", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockRejectedValueOnce(new Error("offline"));
    await expect(checkIdempotency("offline-key")).resolves.toMatchObject({ hit: false, unavailable: true });

    vi.mocked(getRedis).mockRejectedValueOnce(new Error("offline"));
    await expect(acquirePending("offline-key")).resolves.toBe("unavailable");
  });

  it("does not report a successful mutation when the idempotency result cannot be stored", async () => {
    const { getRedis } = await import("@/lib/redis");
    redis.setex.mockRejectedValueOnce(new Error("write failed"));
    await expect(setIdempotencyResult("write-failure", 201, { id: "task-1" })).rejects.toThrow(
      "Idempotency storage is unavailable",
    );
    vi.mocked(getRedis).mockResolvedValue(redis as never);
  });
});