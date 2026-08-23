import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { grantGroupProjectRole, listGroups, listProjectGroupGrants } from "@/lib/groups";
import { notifyGroupRoleChange } from "@/lib/notifications";
import { projectGroupGrantSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  if (!(await canReadProject(userId, resolvedParams.projectId, organizationId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  const grants = await listProjectGroupGrants(resolvedParams.projectId);

  // The group picker is only useful to users who can actually grant, so only
  // include the group list for them (default-deny for viewers/contributors).
  const canAssign = await canProject(userId, "project_role:assign", resolvedParams.projectId, organizationId);
  const groups = canAssign ? await listGroups(organizationId) : [];

  return NextResponse.json({ data: grants, groups });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  if (!(await canProject(userId, "project_role:assign", resolvedParams.projectId, organizationId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const parsed = projectGroupGrantSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { groupId, role } = parsed.data;

  const group = await prisma.ldapSyncGroup.findUnique({
    where: { id: groupId, organizationId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!group || group.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, { status: 404 });
  }

  const grant = await grantGroupProjectRole(resolvedParams.projectId, groupId, role ?? "contributor", userId);

  await logAudit({
    organizationId,
    actorUserId: userId,
    action: "group_grant_created",
    entityType: "project",
    entityId: resolvedParams.projectId,
    after: { groupId, role: grant.role },
  });

  const project = await prisma.project.findUnique({
    where: { id: resolvedParams.projectId, organizationId },
    select: { name: true },
  });
  if (project) {
    await notifyGroupRoleChange({
      groupId,
      groupName: group.name,
      projectId: resolvedParams.projectId,
      projectName: project.name,
      role: grant.role,
      action: "granted",
    });
  }

  return NextResponse.json({ data: grant }, { status: 201 });
}
