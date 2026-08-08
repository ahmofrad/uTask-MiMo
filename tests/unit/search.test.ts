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
    role: { findFirst: vi.fn() },
    department: { findMany: vi.fn().mockResolvedValue([]) },
    projectMember: { findMany: vi.fn() },
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

  it("searches only projects readable by the authenticated user", async () => {
    const { prisma } = await import("@/lib/db");
    const { search } = await import("@/lib/search");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([{ projectId: "project-1" }] as never);

    await search({ query: "login", type: "task", limit: 10, userId: "user-1" });

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: { in: ["project-1"] } }),
      }),
    );
  });

  it("uses project ids when searching projects", async () => {
    const { prisma } = await import("@/lib/db");
    const { search } = await import("@/lib/search");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.projectMember.findMany).mockResolvedValue([{ projectId: "project-1" }] as never);

    await search({ query: "login", type: "project", limit: 10, userId: "user-1" });

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["project-1"] } }),
      }),
    );
  });
});
