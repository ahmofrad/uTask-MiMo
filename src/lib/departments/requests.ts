import { prisma } from "@/lib/db";

export async function canApproveDepartmentLinkRequest(
  userId: string,
  departmentId: string,
  requestedById?: string,
): Promise<boolean> {
  const globalRole = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (globalRole?.type === "owner" || globalRole?.type === "admin") return true;

  if (requestedById) {
    const requesterDepartments = await prisma.department.findMany({
      where: {
        deletedAt: null,
        managerUserId: userId,
        manager: { status: "active" },
        ldapSyncGroupId: { not: null },
        ldapSyncGroup: {
          deletedAt: null,
          memberships: { some: { userId: requestedById } },
        },
      },
      select: { id: true },
    });
    if (requesterDepartments.length > 0) return true;
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      deletedAt: true,
      managerUserId: true,
      manager: { select: { status: true } },
    },
  });

  return department?.deletedAt === null
    && department.managerUserId === userId
    && department.manager?.status === "active";
}

export async function getDepartmentLinkRequestRecipientIds(
  requestedById: string,
  targetDepartmentId: string,
): Promise<string[]> {
  const [targetDepartment, requesterDepartments] = await Promise.all([
    prisma.department.findUnique({
      where: { id: targetDepartmentId },
      select: {
        deletedAt: true,
        managerUserId: true,
        manager: { select: { status: true } },
      },
    }),
    prisma.department.findMany({
      where: {
        deletedAt: null,
        managerUserId: { not: null },
        manager: { status: "active" },
        ldapSyncGroupId: { not: null },
        ldapSyncGroup: {
          deletedAt: null,
          memberships: { some: { userId: requestedById } },
        },
      },
      select: { managerUserId: true },
    }),
  ]);

  const recipients: string[] = [];
  if (
    targetDepartment?.deletedAt === null
    && targetDepartment.managerUserId
    && targetDepartment.manager?.status === "active"
  ) {
    recipients.push(targetDepartment.managerUserId);
  }
  for (const department of requesterDepartments) {
    if (department.managerUserId) recipients.push(department.managerUserId);
  }
  return Array.from(new Set(recipients));
}
