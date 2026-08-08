import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    department: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    ldapGroupMembership: { findUnique: vi.fn() },
    projectDepartment: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listDepartmentManagerCandidates,
  listProjectLinkDepartments,
} from "@/lib/departments";

const mockDepartment = {
  id: "dept-1",
  name: "Engineering",
  parentId: null,
  managerUserId: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listDepartments", () => {
  it("returns departments where deletedAt is null", async () => {
    vi.mocked(prisma.department.findMany).mockResolvedValue([mockDepartment] as never);

    const result = await listDepartments();

    expect(result).toHaveLength(1);
    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      }),
    );
  });

  it("returns empty array when no departments exist", async () => {
    vi.mocked(prisma.department.findMany).mockResolvedValue([]);

    const result = await listDepartments();

    expect(result).toEqual([]);
  });
});

describe("getDepartmentById", () => {
  it("returns department by id", async () => {
    vi.mocked(prisma.department.findFirst).mockResolvedValue(mockDepartment as never);

    const result = await getDepartmentById("dept-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("dept-1");
    expect(prisma.department.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dept-1", deletedAt: null },
      }),
    );
  });

  it("returns null when department not found", async () => {
    vi.mocked(prisma.department.findFirst).mockResolvedValue(null);

    const result = await getDepartmentById("nonexistent");

    expect(result).toBeNull();
  });
});

describe("createDepartment", () => {
  it("creates department with name", async () => {
    vi.mocked(prisma.department.create).mockResolvedValue(mockDepartment as never);

    const result = await createDepartment({ name: "Engineering" });

    expect(result.id).toBe("dept-1");
    expect(prisma.department.create).toHaveBeenCalledWith({
      data: {
        name: "Engineering",
        parentId: null,
        managerUserId: null,
      },
    });
  });

  it("creates department with parent and manager", async () => {
    const deptWithParent = { ...mockDepartment, parentId: "dept-0", managerUserId: "user-1" };
    vi.mocked(prisma.department.create).mockResolvedValue(deptWithParent as never);

    await createDepartment({
      name: "Backend",
      parentId: "dept-0",
      managerUserId: "user-1",
    });

    expect(prisma.department.create).toHaveBeenCalledWith({
      data: {
        name: "Backend",
        parentId: "dept-0",
        managerUserId: "user-1",
      },
    });
  });
});

describe("updateDepartment", () => {
  it("updates department name", async () => {
    const updated = { ...mockDepartment, name: "Platform" };
    vi.mocked(prisma.department.update).mockResolvedValue(updated as never);

    const result = await updateDepartment("dept-1", { name: "Platform" });

    expect(result.name).toBe("Platform");
    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "dept-1" },
      data: { name: "Platform" },
    });
  });

  it("updates manager", async () => {
    vi.mocked(prisma.department.update).mockResolvedValue(mockDepartment as never);

    await updateDepartment("dept-1", { managerUserId: "user-2" });

    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "dept-1" },
      data: { managerUserId: "user-2" },
    });
  });

  it("allows an active LDAP member to manage an LDAP-backed department", async () => {
    vi.mocked(prisma.department.findFirst).mockResolvedValue({
      ...mockDepartment,
      source: "ldap",
      ldapSyncGroupId: "group-1",
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ status: "active" } as never);
    vi.mocked(prisma.ldapGroupMembership.findUnique).mockResolvedValue({ userId: "user-2" } as never);
    vi.mocked(prisma.department.update).mockResolvedValue(mockDepartment as never);

    await updateDepartment("dept-1", { managerUserId: "user-2" });

    expect(prisma.ldapGroupMembership.findUnique).toHaveBeenCalledWith({
      where: { userId_ldapSyncGroupId: { userId: "user-2", ldapSyncGroupId: "group-1" } },
      select: { userId: true },
    });
  });

  it("rejects a suspended LDAP user as department manager", async () => {
    vi.mocked(prisma.department.findFirst).mockResolvedValue({
      ...mockDepartment,
      source: "ldap",
      ldapSyncGroupId: "group-1",
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ status: "suspended" } as never);

    await expect(updateDepartment("dept-1", { managerUserId: "user-2" })).rejects.toThrow(
      "Department manager must be an active LDAP-synchronized member",
    );
    expect(prisma.department.update).not.toHaveBeenCalled();
  });

  it("does not include undefined fields", async () => {
    vi.mocked(prisma.department.update).mockResolvedValue(mockDepartment as never);

    await updateDepartment("dept-1", {});

    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "dept-1" },
      data: {},
    });
  });
});

describe("listDepartmentManagerCandidates", () => {
  it("returns active members of the department LDAP group", async () => {
    vi.mocked(prisma.department.findFirst).mockResolvedValue({
      ldapSyncGroupId: "group-1",
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-1", displayName: "Alice", email: "alice@example.test" },
    ] as never);

    const result = await listDepartmentManagerCandidates("dept-1");

    expect(result).toEqual([{ id: "user-1", displayName: "Alice", email: "alice@example.test" }]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { status: "active", ldapMemberships: { some: { ldapSyncGroupId: "group-1", group: { deletedAt: null } } } },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: "asc" },
    });
  });
});

describe("listProjectLinkDepartments", () => {
  it("excludes departments already linked to the project", async () => {
    vi.mocked(prisma.projectDepartment.findMany).mockResolvedValue([
      { departmentId: "linked-department" },
    ] as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { id: "other-department", name: "Other", parentId: null, source: "ldap" },
    ] as never);

    const result = await listProjectLinkDepartments("project-1");

    expect(result).toEqual([{ id: "other-department", name: "Other", parentId: null, source: "ldap" }]);
    expect(prisma.department.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, id: { notIn: ["linked-department"] } },
      select: { id: true, name: true, parentId: true, source: true },
      orderBy: { name: "asc" },
    });
  });
});

describe("deleteDepartment", () => {
  it("sets deletedAt for soft delete", async () => {
    vi.mocked(prisma.department.update).mockResolvedValue(mockDepartment as never);

    await deleteDepartment("dept-1");

    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "dept-1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
