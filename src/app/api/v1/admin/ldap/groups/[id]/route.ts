import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const group = await prisma.ldapSyncGroup.findUnique({
    where: { id: resolvedParams.id },
    include: { department: { select: { id: true } } },
  });
  if (!group) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const memberships = await prisma.ldapGroupMembership.findMany({
    where: { ldapSyncGroupId: group.id },
    select: { userId: true },
  });
  const affectedUserIds = [...new Set(memberships.map((membership) => membership.userId))];

  const remainingMemberships = affectedUserIds.length > 0
    ? await prisma.ldapGroupMembership.findMany({
        where: { userId: { in: affectedUserIds }, group: { deletedAt: null } },
        select: { userId: true },
      })
    : [];
  const remainingUserIds = new Set(remainingMemberships.map((membership) => membership.userId));
  const orphanedUserIds = affectedUserIds.filter((userId) => !remainingUserIds.has(userId));

  if (orphanedUserIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: orphanedUserIds } },
      data: { status: "ldapGroupRemoved", ldapGroupId: null },
    });
    await prisma.projectMember.updateMany({
      where: { userId: { in: orphanedUserIds } },
      data: { disabledAt: new Date(), disabledReason: "ldap" },
    });
  }

  if (group.department) {
    await prisma.department.update({
      where: { id: group.department.id },
      data: { deletedAt: new Date() },
    });
  }

  await prisma.ldapSyncGroup.update({
    where: { id: group.id },
    data: { deletedAt: new Date() },
  });

  if (group.department) {
    await logAudit({
      actorUserId: userId,
      action: "department_deleted",
      entityType: "department",
      entityId: group.department.id,
      before: { sourceGroupId: group.id },
      after: { deletedAt: true },
    });
  }

  await logAudit({
    actorUserId: userId,
    action: "ldap_group_removed",
    entityType: "ldapgroup",
    entityId: group.id,
    before: { dn: group.dn, name: group.name },
    after: { usersAffected: orphanedUserIds.length },
  });

  return NextResponse.json({ data: { success: true, usersAffected: orphanedUserIds.length } });
}