import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSet, mockEval } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockEval: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn().mockResolvedValue({ set: mockSet, eval: mockEval }),
}));
vi.mock("@/lib/logging", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

import { withDistributedLock } from "@/lib/queue/lock";

describe("withDistributedLock", () => {
  beforeEach(() => {
    mockSet.mockReset();
    mockEval.mockReset().mockResolvedValue(1);
  });

  it("runs work when the lock is acquired and releases it", async () => {
    mockSet.mockResolvedValue("OK");
    const result = await withDistributedLock("sync", 10_000, async () => 42);
    expect(result).toBe(42);
    expect(mockSet).toHaveBeenCalledWith("taskapp:lock:sync", expect.any(String), "PX", 10_000, "NX");
    expect(mockEval).toHaveBeenCalledWith(expect.any(String), 1, "taskapp:lock:sync", expect.any(String));
  });

  it("skips work when the lock is held elsewhere", async () => {
    mockSet.mockResolvedValue(null);
    const work = vi.fn().mockResolvedValue(1);
    const result = await withDistributedLock("sync", 10_000, work);
    expect(result).toBeUndefined();
    expect(work).not.toHaveBeenCalled();
    expect(mockEval).not.toHaveBeenCalled();
  });

  it("releases the lock even when work throws (error swallowed)", async () => {
    mockSet.mockResolvedValue("OK");
    const result = await withDistributedLock("sync", 10_000, async () => { throw new Error("boom"); });
    expect(result).toBeUndefined();
    expect(mockEval).toHaveBeenCalled();
  });

  it("returns undefined when redis is unavailable", async () => {
    const { getRedis } = await import("@/lib/redis");
    (getRedis as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("no redis"));
    const result = await withDistributedLock("sync", 10_000, async () => 1);
    expect(result).toBeUndefined();
  });
});