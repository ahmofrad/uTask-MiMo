import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    role: { findFirst: vi.fn() },
    projectMember: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    department: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { getUserReadableProjectIds, listProjects } from "@/lib/projects/queries";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
  vi.mocked(prisma.projectMember.findMany).mockResolvedValue([]);
  vi.mocked(prisma.project.findMany).mockResolvedValue([]);
  vi.mocked(prisma.department.findMany).mockResolvedValue([]);
});

describe("getUserReadableProjectIds", () => {
  it("includes projects in descendant departments for a scoped manager", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { id: "root", parentId: null, managerUserId: "manager-1", manager: { status: "active" }, deletedAt: null },
      { id: "child", parentId: "root", managerUserId: null, deletedAt: null },
    ] as never);
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: "child-project" },
    ] as never);

    await expect(getUserReadableProjectIds("manager-1")).resolves.toEqual(["child-project"]);
    expect(prisma.projectMember.findMany).toHaveBeenCalledWith({
      where: { userId: "manager-1", disabledAt: null, project: { archivedAt: null } },
      select: { projectId: true },
    });
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        OR: [
          { departmentId: { in: ["root", "child"] } },
          { departmentLinks: { some: { departmentId: { in: ["root", "child"] } } } },
        ],
      },
      select: { id: true },
    });
  });

  it("filters by primary or secondary department links", async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([]);

    await listProjects({ limit: 20, departmentId: "department-2" });

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        archivedAt: null,
        OR: [
          { departmentId: "department-2" },
          { departmentLinks: { some: { departmentId: "department-2" } } },
        ],
      },
    }));
  });
});
