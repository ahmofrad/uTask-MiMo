import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    role: { findFirst: vi.fn() },
    department: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { canApproveDepartmentLinkRequest, getDepartmentLinkRequestRecipientIds } from "@/lib/departments/requests";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "member" } as never);
});

describe("canApproveDepartmentLinkRequest", () => {
  it("allows Owner/Admin override", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ type: "admin" } as never);

    await expect(canApproveDepartmentLinkRequest("admin-1", "department-1")).resolves.toBe(true);
    expect(prisma.department.findUnique).not.toHaveBeenCalled();
  });

  it("allows the active target department manager", async () => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      deletedAt: null,
      managerUserId: "manager-1",
      manager: { status: "active" },
    } as never);

    await expect(canApproveDepartmentLinkRequest("manager-1", "department-1")).resolves.toBe(true);
  });

  it("denies another manager and suspended target managers", async () => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      deletedAt: null,
      managerUserId: "manager-1",
      manager: { status: "suspended" },
    } as never);

    await expect(canApproveDepartmentLinkRequest("manager-1", "department-1")).resolves.toBe(false);
    await expect(canApproveDepartmentLinkRequest("manager-2", "department-1")).resolves.toBe(false);
  });

  it("allows an active manager of the requester LDAP departments", async () => {
    vi.mocked(prisma.department.findMany).mockResolvedValue([{ id: "requester-department" }] as never);
    vi.mocked(prisma.department.findUnique).mockResolvedValue(null);

    await expect(
      canApproveDepartmentLinkRequest("requester-manager", "target-department", "requester-1"),
    ).resolves.toBe(true);
    expect(prisma.department.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ managerUserId: "requester-manager" }),
    }));
  });

  it("returns active, deduplicated request notification recipients", async () => {
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      deletedAt: null,
      managerUserId: "manager-target",
      manager: { status: "active" },
    } as never);
    vi.mocked(prisma.department.findMany).mockResolvedValue([
      { managerUserId: "manager-requester" },
      { managerUserId: "manager-target" },
    ] as never);

    await expect(getDepartmentLinkRequestRecipientIds("requester-1", "target-department"))
      .resolves.toEqual(["manager-target", "manager-requester"]);
  });
});
