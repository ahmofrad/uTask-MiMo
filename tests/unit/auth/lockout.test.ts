import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
let nextIncr = 1;

const redis = {
  get: vi.fn(async (key: string) => values.get(key) ?? null),
  set: vi.fn(async (key: string, value: string, _mode?: string, _ttl?: number) => {
    values.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    values.delete(key);
  }),
  incr: vi.fn(async (key: string) => {
    const current = Number(values.get(key) ?? 0) + 1;
    values.set(key, String(current));
    return current;
  }),
  expire: vi.fn(async () => 1),
};

vi.mock("@/lib/redis", () => ({ getRedis: vi.fn(async () => redis) }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(async () => ({ id: "user-1" })) } },
}));

import { auditLockout, clearLockout, isLockedOut, recordFailedLogin } from "@/lib/auth/lockout";

describe("auth lockout", () => {
  beforeEach(() => {
    values.clear();
    nextIncr = 1;
    vi.clearAllMocks();
  });

  it("starts unlocked", async () => {
    await expect(isLockedOut("a@b.com")).resolves.toBe(false);
  });

  it("locks the account after AUTH_MAX_FAILED_ATTEMPTS failures", async () => {
    let locked = false;
    for (let i = 0; i < 5; i++) {
      locked = await recordFailedLogin("a@b.com");
    }
    expect(locked).toBe(true);
    await expect(isLockedOut("A@B.com")).resolves.toBe(true); // case-insensitive key
  });

  it("does not lock before the threshold is reached", async () => {
    for (let i = 0; i < 4; i++) {
      await expect(recordFailedLogin("a@b.com")).resolves.toBe(false);
    }
    await expect(isLockedOut("a@b.com")).resolves.toBe(false);
  });

  it("returns false (not locked) when Redis is unavailable", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockRejectedValueOnce(new Error("offline"));
    await expect(isLockedOut("a@b.com")).resolves.toBe(false);
    vi.mocked(getRedis).mockResolvedValue(redis as never);
  });

  it("does not throw when Redis is unavailable during recordFailedLogin", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockRejectedValue(new Error("offline"));
    await expect(recordFailedLogin("a@b.com")).resolves.toBe(false);
    await expect(clearLockout("a@b.com")).resolves.toBeUndefined();
    vi.mocked(getRedis).mockResolvedValue(redis as never);
  });

  it("clearLockout unlocks the account", async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLogin("a@b.com");
    }
    await expect(isLockedOut("a@b.com")).resolves.toBe(true);
    await clearLockout("a@b.com");
    await expect(isLockedOut("a@b.com")).resolves.toBe(false);
  });

  it("auditLockout writes a login_failed audit entry with the user id", async () => {
    const { logAudit } = await import("@/lib/audit/log");
    const { prisma } = await import("@/lib/db");
    await auditLockout("A@B.com");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "a@b.com" },
      select: { id: true },
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "login_failed", entityType: "user", entityId: "user-1" }),
    );
  });
});