import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const permitted = await can(session.user.id, "sso:configure");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

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
    actorUserId: session.user.id,
    action: "ldap_group_removed",
    entityType: "ldapgroup",
    entityId: group.id,
    before: { dn: group.dn, name: group.name },
    after: { usersAffected: updated.count },
  });

  return NextResponse.json({ data: { success: true, usersAffected: updated.count } });
}
