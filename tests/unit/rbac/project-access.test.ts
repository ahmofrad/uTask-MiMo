import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    role: { findFirst: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    projectGroupGrant: { findMany: vi.fn() },
    department: { findMany: vi.fn() },
    task: { findUnique: vi.fn() },
  },
}));

describe("project read access", () => {
  it("allows an owner to read any active project", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "owner" } as never);

    await expect(canReadProject("owner-1", "project-1")).resolves.toBe(true);
  });

  it("allows an active project member to read the project", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({ archivedAt: null, department: null, departmentLinks: [] } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({ disabledAt: null } as never);

    await expect(canReadProject("member-1", "project-1")).resolves.toBe(true);
  });

  it("denies archived projects and non-members", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.projectMember.findUnique)
      .mockResolvedValueOnce({ project: { archivedAt: new Date() } } as never)
      .mockResolvedValueOnce(null);

    await expect(canReadProject("member-2", "project-2")).resolves.toBe(false);
    await expect(canReadProject("member-3", "project-3")).resolves.toBe(false);
  });

  it("requires project access for task reads", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadTask } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ projectId: "project-4" } as never);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({ archivedAt: null, department: null, departmentLinks: [] } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({ disabledAt: null } as never);

    await expect(canReadTask("member-4", "task-4")).resolves.toBe(true);
  });

  it("limits managers to projects in their managed department", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "manager" } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: null,
      department: { managerUserId: "manager-1" },
    } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);

    await expect(canReadProject("manager-1", "department-project")).resolves.toBe(true);
    await expect(canReadProject("manager-2", "department-project")).resolves.toBe(false);
  });

  it("allows a department manager to read descendant projects without a global manager role", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: null,
      department: null,
      departmentLinks: [{ departmentId: "child-department" }],
    } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { id: "root-department", parentId: null, managerUserId: "manager-1", manager: { status: "active" }, deletedAt: null },
      { id: "child-department", parentId: "root-department", managerUserId: null, deletedAt: null },
      { id: "sibling-department", parentId: null, managerUserId: null, deletedAt: null },
    ] as never);

    await expect(canReadProject("manager-1", "descendant-project")).resolves.toBe(true);
  });

  it("allows scoped task mutations through any linked department", async () => {
    const { prisma } = await import("@/lib/db");
    const { canProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: null,
      department: null,
      departmentLinks: [{ departmentId: "child-department" }, { departmentId: "other-department" }],
    } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { id: "root-department", parentId: null, managerUserId: "manager-1", manager: { status: "active" }, deletedAt: null },
      { id: "child-department", parentId: "root-department", managerUserId: null, deletedAt: null },
      { id: "other-department", parentId: null, managerUserId: null, deletedAt: null },
    ] as never);

    await expect(canProject("manager-1", "task:edit_any", "linked-project")).resolves.toBe(true);
  });

  it("does not extend a department manager's scope to sibling departments", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: null,
      department: { id: "sibling-department" },
    } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { id: "root-department", parentId: null, managerUserId: "manager-1", manager: { status: "active" }, deletedAt: null },
      { id: "sibling-department", parentId: null, managerUserId: null, deletedAt: null },
    ] as never);

    await expect(canReadProject("manager-1", "sibling-project")).resolves.toBe(false);
  });

  it("never grants global edit roles access to deleted tasks", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadTask } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "admin" } as never);
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      projectId: "project-deleted",
      deletedAt: new Date(),
    } as never);

    await expect(canReadTask("admin-1", "deleted-task")).resolves.toBe(false);
  });

  it("denies project mutations to members after the project is archived", async () => {
    const { prisma } = await import("@/lib/db");
    const { canProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      projectRole: "lead",
      project: { archivedAt: new Date() },
    } as never);

    await expect(canProject("member-5", "task:edit_any", "archived-project")).resolves.toBe(false);
  });

  beforeEach(async () => {
    const { prisma } = await import("@/lib/db");
    vi.clearAllMocks();
    vi.mocked(prisma.role.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.projectGroupGrant.findMany).mockResolvedValue([]);
    vi.mocked(prisma.department.findMany).mockResolvedValue([]);
    vi.mocked(prisma.task.findUnique).mockResolvedValue(null);
  });
});