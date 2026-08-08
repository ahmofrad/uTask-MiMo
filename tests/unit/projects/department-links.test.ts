import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, mockCanApprove } = vi.hoisted(() => ({
  prisma: {
    projectDepartment: { findUnique: vi.fn(), upsert: vi.fn() },
    projectDepartmentLinkRequest: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn(), update: vi.fn() },
    department: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  mockCanApprove: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/departments/requests", () => ({ canApproveDepartmentLinkRequest: mockCanApprove }));

import {
  createDepartmentLinkRequest,
  reviewDepartmentLinkRequest,
} from "@/lib/projects/department-links";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.projectDepartment.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.project.findUnique).mockResolvedValue({ id: "project-1", archivedAt: null } as never);
  vi.mocked(prisma.department.findFirst).mockResolvedValue({ id: "department-2" } as never);
  vi.mocked(prisma.projectDepartmentLinkRequest.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.projectDepartmentLinkRequest.create).mockResolvedValue({ id: "request-1", status: "pending" } as never);
  vi.mocked(prisma.projectDepartmentLinkRequest.update).mockResolvedValue({ id: "request-1", status: "rejected" } as never);
  vi.mocked(prisma.projectDepartmentLinkRequest.findUnique).mockResolvedValue({
    id: "request-1",
    projectId: "project-1",
    departmentId: "department-2",
    requestedById: "manager-1",
    status: "pending",
    project: { departmentId: "department-1" },
  } as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  mockCanApprove.mockResolvedValue(true);
});

describe("createDepartmentLinkRequest", () => {
  it("creates a pending request when the project is not already linked", async () => {
    await expect(createDepartmentLinkRequest({
      projectId: "project-1",
      departmentId: "department-2",
      requestedById: "manager-1",
    })).resolves.toEqual({ id: "request-1", status: "pending" });

    expect(prisma.projectDepartmentLinkRequest.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        departmentId: "department-2",
        requestedById: "manager-1",
      },
      include: {
        project: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
  });

  it("does not create a duplicate request or link", async () => {
    vi.mocked(prisma.projectDepartmentLinkRequest.findFirst).mockResolvedValue({ id: "existing" } as never);

    await expect(createDepartmentLinkRequest({
      projectId: "project-1",
      departmentId: "department-2",
      requestedById: "manager-1",
    })).resolves.toEqual({ kind: "pending", id: "existing" });
    expect(prisma.projectDepartmentLinkRequest.create).not.toHaveBeenCalled();
  });

  it("rejects missing or archived project and department references", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

    await expect(createDepartmentLinkRequest({
      projectId: "missing-project",
      departmentId: "department-2",
      requestedById: "manager-1",
    })).resolves.toEqual({ kind: "not_found" });
    expect(prisma.projectDepartmentLinkRequest.create).not.toHaveBeenCalled();
  });
});

describe("reviewDepartmentLinkRequest", () => {
  it("approves by adding the link and recording the reviewer", async () => {
    vi.mocked(prisma.projectDepartmentLinkRequest.update).mockResolvedValue({ id: "request-1", status: "approved" } as never);

    await expect(reviewDepartmentLinkRequest("request-1", "manager-2", "approved")).resolves.toEqual({
      id: "request-1",
      status: "approved",
    });
    expect(prisma.projectDepartment.upsert).toHaveBeenCalledWith({
      where: { projectId_departmentId: { projectId: "project-1", departmentId: "department-2" } },
      create: { projectId: "project-1", departmentId: "department-2" },
      update: {},
    });
  });

  it("rejects without creating a project link", async () => {
    await expect(reviewDepartmentLinkRequest("request-1", "manager-2", "rejected")).resolves.toEqual({
      id: "request-1",
      status: "rejected",
    });
    expect(prisma.projectDepartment.upsert).not.toHaveBeenCalled();
  });

  it("allows the requester to cancel a pending request", async () => {
    vi.mocked(prisma.projectDepartmentLinkRequest.update).mockResolvedValue({ id: "request-1", status: "cancelled" } as never);

    await expect(reviewDepartmentLinkRequest("request-1", "manager-1", "cancelled")).resolves.toEqual({
      id: "request-1",
      status: "cancelled",
    });
    expect(mockCanApprove).not.toHaveBeenCalled();
    expect(prisma.projectDepartmentLinkRequest.update).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: { status: "cancelled", reviewedById: "manager-1", reviewedAt: expect.any(Date) },
    });
  });

  it("does not review a request through a different project", async () => {
    await expect(reviewDepartmentLinkRequest("request-1", "manager-2", "approved", "other-project")).resolves.toEqual({
      kind: "not_found",
    });
    expect(mockCanApprove).not.toHaveBeenCalled();
  });
});
