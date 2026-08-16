import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canManageGroup } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { removeGroupMember } from "@/lib/groups";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId: actorUserId } = authResult;

  if (!(await canManageGroup(actorUserId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }
  const group = await prisma.ldapSyncGroup.findUnique({
    where: { id: resolvedParams.id },
    select: { id: true, deletedAt: true },
  });
  if (!group || group.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, { status: 404 });
  }

  const membership = await removeGroupMember(group.id, resolvedParams.userId);
  if (!membership) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User is not a member of this group" } }, { status: 404 });
  }

  await logAudit({
    actorUserId,
    action: "group_member_removed",
    entityType: "group",
    entityId: group.id,
    after: { userId: resolvedParams.userId },
  });

  return NextResponse.json({ data: { success: true } });
}
