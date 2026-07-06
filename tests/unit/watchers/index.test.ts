import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    watcher: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { ensureWatcher, removeWatcher, getWatchers } from "@/lib/watchers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("watchers", () => {
  it("ensureWatcher creates watcher if not exists", async () => {
    vi.mocked(prisma.watcher.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.watcher.create).mockResolvedValue({} as never);

    await ensureWatcher("task-1", "user-1");

    expect(prisma.watcher.create).toHaveBeenCalledWith({
      data: { taskId: "task-1", userId: "user-1" },
    });
  });

  it("ensureWatcher is idempotent", async () => {
    vi.mocked(prisma.watcher.findUnique).mockResolvedValue({} as never);

    await ensureWatcher("task-1", "user-1");

    expect(prisma.watcher.create).not.toHaveBeenCalled();
  });

  it("ensureWatcher ignores null userId", async () => {
    await ensureWatcher("task-1", null);
    expect(prisma.watcher.create).not.toHaveBeenCalled();
  });

  it("removeWatcher deletes records", async () => {
    vi.mocked(prisma.watcher.deleteMany).mockResolvedValue({ count: 1 } as never);

    await removeWatcher("task-1", "user-1");

    expect(prisma.watcher.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task-1", userId: "user-1" },
    });
  });

  it("getWatchers returns watcher list with user info", async () => {
    vi.mocked(prisma.watcher.findMany).mockResolvedValue([
      { userId: "user-1", user: { id: "user-1", displayName: "Alice", email: "a@test.com", avatarUrl: null } },
    ] as never);

    const result = await getWatchers("task-1");

    expect(result).toHaveLength(1);
    expect(prisma.watcher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taskId: "task-1" } }),
    );
  });
});
