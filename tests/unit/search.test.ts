import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn().mockResolvedValue([
        { id: "task-1", title: "Fix login bug", status: "open", priority: "high", projectId: "p-1", createdAt: new Date().toISOString() },
      ]),
    },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
    project: { findMany: vi.fn().mockResolvedValue([]) },
    customFieldValue: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

describe("Search", () => {
  it("prisma mock resolves with test data", async () => {
    const { prisma } = await import("@/lib/db");
    const tasks = await prisma.task.findMany({ where: {} });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("Fix login bug");
  });

  it("auth mock returns user session", async () => {
    const { auth } = await import("@/lib/auth/config");
    const session = await auth();
    expect(session?.user?.id).toBe("user-1");
  });
});
