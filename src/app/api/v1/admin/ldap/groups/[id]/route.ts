import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(_request, { params });
  if (guardResult) return guardResult;

  const group = await prisma.ldapSyncGroup.findUnique({ where: { id: params.id } });
  if (!group) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  // Mark the group's users as removed (do not delete them); they can no longer log in.
  const updated = await prisma.user.updateMany({
    where: { ldapGroupId: params.id },
    data: { status: "ldapGroupRemoved", ldapGroupId: null },
  });

  await prisma.ldapSyncGroup.delete({ where: { id: params.id } });

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