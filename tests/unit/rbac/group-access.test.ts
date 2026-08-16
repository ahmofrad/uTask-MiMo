import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    role: { findFirst: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    projectGroupGrant: { findMany: vi.fn() },
    department: { findMany: vi.fn() },
    ldapSyncGroup: { findFirst: vi.fn() },
  },
}));

const departments = [
  { id: "root-department", parentId: null, managerUserId: "manager-1", manager: { status: "active" }, deletedAt: null },
  { id: "child-department", parentId: "root-department", managerUserId: null, deletedAt: null },
  { id: "sibling-department", parentId: null, managerUserId: null, deletedAt: null },
];

describe("canManageGroup", () => {
  it("allows owner and admin to manage any group", async () => {
    const { prisma } = await import("@/lib/db");
    const { canManageGroup } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "owner" } as never);
    await expect(canManageGroup("owner-1", "group-1")).resolves.toBe(true);
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "admin" } as never);
    await expect(canManageGroup("admin-1", "group-1")).resolves.toBe(true);
  });

  it("allows a manager to manage a group whose owner department is in their subtree", async () => {
    const { prisma } = await import("@/lib/db");
    const { canManageGroup } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.ldapSyncGroup.findFirst).mockResolvedValue({
      ownerDepartmentId: "child-department",
      department: null,
    } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue(departments as never);

    await expect(canManageGroup("manager-1", "group-1")).resolves.toBe(true);
  });

  it("denies a manager a group outside their department subtree", async () => {
    const { prisma } = await import("@/lib/db");
    const { canManageGroup } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.ldapSyncGroup.findFirst).mockResolvedValue({
      ownerDepartmentId: "sibling-department",
      department: null,
    } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue(departments as never);

    await expect(canManageGroup("manager-1", "group-1")).resolves.toBe(false);
  });

  it("falls back to the linked department for LDAP groups", async () => {
    const { prisma } = await import("@/lib/db");
    const { canManageGroup } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.ldapSyncGroup.findFirst).mockResolvedValue({
      ownerDepartmentId: null,
      department: { id: "child-department" },
    } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue(departments as never);

    await expect(canManageGroup("manager-1", "group-1")).resolves.toBe(true);
  });

  it("denies non-managers and groups without a department", async () => {
    const { prisma } = await import("@/lib/db");
    const { canManageGroup } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.ldapSyncGroup.findFirst).mockResolvedValue({
      ownerDepartmentId: null,
      department: null,
    } as never);
    await expect(canManageGroup("member-1", "group-1")).resolves.toBe(false);

    vi.mocked(prisma.ldapSyncGroup.findFirst).mockResolvedValue(null);
    await expect(canManageGroup("member-1", "missing-group")).resolves.toBe(false);
  });

  it("denies when no global role exists", async () => {
    const { prisma } = await import("@/lib/db");
    const { canManageGroup } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue(null);
    await expect(canManageGroup("nobody", "group-1")).resolves.toBe(false);
  });
});

describe("live group project grants", () => {
  it("grants a member of a granted group the group's project role", async () => {
    const { prisma } = await import("@/lib/db");
    const { canProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: null,
      department: null,
      departmentLinks: [],
    } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.projectGroupGrant.findMany).mockResolvedValue([{ role: "contributor" }] as never);

    await expect(canProject("group-member", "task:edit_own", "project-1")).resolves.toBe(true);
    await expect(canProject("group-member", "task:edit_any", "project-1")).resolves.toBe(false);
  });

  it("uses the highest role when a user belongs to several granted groups", async () => {
    const { prisma } = await import("@/lib/db");
    const { canProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: null,
      department: null,
      departmentLinks: [],
    } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.projectGroupGrant.findMany).mockResolvedValue([
      { role: "viewer" },
      { role: "lead" },
    ] as never);

    await expect(canProject("group-member", "project_role:assign", "project-1")).resolves.toBe(true);
  });

  it("denies when the user belongs to no granted group", async () => {
    const { prisma } = await import("@/lib/db");
    const { canProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: null,
      department: null,
      departmentLinks: [],
    } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.projectGroupGrant.findMany).mockResolvedValue([]);

    await expect(canProject("outsider", "task:edit_own", "project-1")).resolves.toBe(false);
  });

  it("denies group grants on archived projects", async () => {
    const { prisma } = await import("@/lib/db");
    const { canProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: new Date(),
      department: null,
      departmentLinks: [],
    } as never);

    await expect(canProject("group-member", "task:edit_own", "archived-project")).resolves.toBe(false);
  });

  it("grants read access via a group role", async () => {
    const { prisma } = await import("@/lib/db");
    const { canReadProject } = await import("@/lib/rbac/can");
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      archivedAt: null,
      department: null,
      departmentLinks: [],
    } as never);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.projectGroupGrant.findMany).mockResolvedValue([{ role: "viewer" }] as never);

    await expect(canReadProject("group-member", "project-1")).resolves.toBe(true);
  });
});

beforeEach(async () => {
  const { prisma } = await import("@/lib/db");
  vi.clearAllMocks();
  vi.mocked(prisma.role.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.projectGroupGrant.findMany).mockResolvedValue([]);
  vi.mocked(prisma.department.findMany).mockResolvedValue([]);
  vi.mocked(prisma.ldapSyncGroup.findFirst).mockResolvedValue(null);
});
