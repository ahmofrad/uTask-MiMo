import { prisma } from "@/lib/db";
import { canApproveDepartmentLinkRequest } from "@/lib/departments/requests";

export type DepartmentLinkRequestDecision = "approved" | "rejected" | "cancelled";

export async function createDepartmentLinkRequest(data: {
  projectId: string;
  departmentId: string;
  requestedById: string;
}) {
  const [project, department] = await Promise.all([
    prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, archivedAt: true },
    }),
    prisma.department.findFirst({
      where: { id: data.departmentId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!project || project.archivedAt !== null || !department) return { kind: "not_found" as const };

  const existingLink = await prisma.projectDepartment.findUnique({
    where: {
      projectId_departmentId: {
        projectId: data.projectId,
        departmentId: data.departmentId,
      },
    },
  });
  if (existingLink) return { kind: "linked" as const, id: data.departmentId };

  const existingRequest = await prisma.projectDepartmentLinkRequest.findFirst({
    where: {
      projectId: data.projectId,
      departmentId: data.departmentId,
      status: "pending",
    },
    select: { id: true },
  });
  if (existingRequest) return { kind: "pending" as const, id: existingRequest.id };

  return prisma.projectDepartmentLinkRequest.create({
    data,
    include: {
      project: { select: { name: true } },
      department: { select: { name: true } },
    },
  });
}

export async function reviewDepartmentLinkRequest(
  requestId: string,
  reviewerId: string,
  decision: DepartmentLinkRequestDecision,
  expectedProjectId?: string,
) {
  const request = await prisma.projectDepartmentLinkRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      projectId: true,
      departmentId: true,
      requestedById: true,
      status: true,
      project: { select: { departmentId: true } },
    },
  });
  if (!request) return { kind: "not_found" as const };
  if (expectedProjectId !== undefined && request.projectId !== expectedProjectId) {
    return { kind: "not_found" as const };
  }
  if (request.status !== "pending") return { kind: "not_pending" as const, status: request.status };
  if (decision === "cancelled") {
    if (request.requestedById !== reviewerId) return { kind: "forbidden" as const };
    return prisma.projectDepartmentLinkRequest.update({
      where: { id: request.id },
      data: { status: "cancelled", reviewedById: reviewerId, reviewedAt: new Date() },
    });
  }
  if (!(await canApproveDepartmentLinkRequest(reviewerId, request.departmentId, request.requestedById))) {
    return { kind: "forbidden" as const };
  }

  const reviewedAt = new Date();
  if (decision === "rejected") {
    return prisma.projectDepartmentLinkRequest.update({
      where: { id: request.id },
      data: { status: "rejected", reviewedById: reviewerId, reviewedAt },
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.projectDepartment.upsert({
      where: {
        projectId_departmentId: {
          projectId: request.projectId,
          departmentId: request.departmentId,
        },
      },
      create: { projectId: request.projectId, departmentId: request.departmentId },
      update: {},
    });

    if (request.project.departmentId === null) {
      await tx.project.update({
        where: { id: request.projectId },
        data: { departmentId: request.departmentId },
      });
    }

    return tx.projectDepartmentLinkRequest.update({
      where: { id: request.id },
      data: { status: "approved", reviewedById: reviewerId, reviewedAt },
    });
  });
}
