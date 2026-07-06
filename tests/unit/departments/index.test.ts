import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    department: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
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

  it("does not include undefined fields", async () => {
    vi.mocked(prisma.department.update).mockResolvedValue(mockDepartment as never);

    await updateDepartment("dept-1", {});

    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "dept-1" },
      data: {},
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
