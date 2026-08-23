import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    role: { findFirst: vi.fn() },
    department: { findFirst: vi.fn(), findMany: vi.fn() },
    departmentMembership: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/departments", () => ({
  getManagedDepartmentIds: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getManagedDepartmentIds } from "@/lib/departments";
import { canAccessDepartment } from "@/lib/rbac/can";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
  vi.mocked(prisma.department.findFirst).mockResolvedValue({ managerUserId: null } as never);
  vi.mocked(prisma.departmentMembership.findUnique).mockResolvedValue(null);
  vi.mocked(getManagedDepartmentIds).mockResolvedValue([]);
});

describe("canAccessDepartment", () => {
  it("allows an active department member", async () => {
    vi.mocked(prisma.departmentMembership.findUnique).mockResolvedValue({ userId: "user-1" } as never);

    await expect(canAccessDepartment("user-1", "department-1")).resolves.toBe(true);
    expect(prisma.departmentMembership.findUnique).toHaveBeenCalledWith({
      where: { userId_departmentId: { userId: "user-1", departmentId: "department-1" } },
      select: { userId: true },
    });
  });

  it("allows a manager of a managed department", async () => {
    vi.mocked(getManagedDepartmentIds).mockResolvedValue(["department-1"]);

    await expect(canAccessDepartment("manager-1", "department-1")).resolves.toBe(true);
  });

  it("allows an organization administrator without a department row", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "admin" } as never);

    await expect(canAccessDepartment("admin-1", "department-1")).resolves.toBe(true);
    expect(prisma.department.findFirst).not.toHaveBeenCalled();
  });

  it("denies an unrelated member", async () => {
    await expect(canAccessDepartment("user-1", "department-1")).resolves.toBe(false);
  });
});
