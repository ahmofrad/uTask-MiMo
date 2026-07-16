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

  const group = await prisma.ldapSyncGroup.findUnique({ where: { id: resolvedParams.id } });
  if (!group) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  // Mark the group's users as removed (do not delete them); they can no longer log in.
  const updated = await prisma.user.updateMany({
    where: { ldapGroupId: resolvedParams.id },
    data: { status: "ldapGroupRemoved", ldapGroupId: null },
  });

  await prisma.ldapSyncGroup.delete({ where: { id: resolvedParams.id } });

  await logAudit({
    actorUserId: userId,
    action: "ldap_group_removed",
    entityType: "ldapgroup",
    entityId: group.id,
    before: { dn: group.dn, name: group.name },
    after: { usersAffected: updated.count },
  });

  return NextResponse.json({ data: { success: true, usersAffected: updated.count } });
}