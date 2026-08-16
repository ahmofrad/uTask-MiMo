import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { revokeGroupProjectRole } from "@/lib/groups";
import { notifyGroupRoleChange } from "@/lib/notifications";
import { prisma } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; groupId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "project_role:assign", resolvedParams.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const grant = await revokeGroupProjectRole(resolvedParams.projectId, resolvedParams.groupId);
  if (!grant) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "This group has no role on this project" } }, { status: 404 });
  }

  await logAudit({
    actorUserId: userId,
    action: "group_grant_revoked",
    entityType: "project",
    entityId: resolvedParams.projectId,
    before: { groupId: resolvedParams.groupId, role: grant.role } as never,
  });

  const [group, project] = await Promise.all([
    prisma.ldapSyncGroup.findUnique({ where: { id: resolvedParams.groupId }, select: { name: true } }),
    prisma.project.findUnique({ where: { id: resolvedParams.projectId }, select: { name: true } }),
  ]);
  if (group && project) {
    await notifyGroupRoleChange({
      groupId: resolvedParams.groupId,
      groupName: group.name,
      projectId: resolvedParams.projectId,
      projectName: project.name,
      role: grant.role,
      action: "revoked",
    });
  }

  return NextResponse.json({ data: { success: true } });
}
