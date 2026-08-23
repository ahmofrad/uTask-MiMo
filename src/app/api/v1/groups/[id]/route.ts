import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canManageGroup } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { deleteGroup, updateGroup } from "@/lib/groups";
import { groupUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

async function getGroupOrDeny(request: Request, userId: string, groupId: string, organizationId: string) {
  const allowed = await canManageGroup(userId, groupId, organizationId);
  if (!allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }
  const group = await prisma.ldapSyncGroup.findUnique({
    where: { id: groupId, organizationId },
    select: { id: true, deletedAt: true },
  });
  if (!group || group.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, { status: 404 });
  }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const denied = await getGroupOrDeny(request, userId, resolvedParams.id, organizationId);
  if (denied) return denied;

  const parsed = groupUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, ownerDepartmentId } = parsed.data;

  if (ownerDepartmentId) {
    const department = await prisma.department.findFirst({
      where: { id: ownerDepartmentId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!department) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Owner department not found" } }, { status: 404 });
    }
  }

  const before = await prisma.ldapSyncGroup.findUnique({
    where: { id: resolvedParams.id, organizationId },
    select: { name: true, ownerDepartmentId: true },
  });

  const group = await updateGroup(resolvedParams.id, {
    ...(name !== undefined ? { name } : {}),
    ...(ownerDepartmentId !== undefined ? { ownerDepartmentId } : {}),
  });

  await logAudit({
    organizationId,
    actorUserId: userId,
    action: "group_updated",
    entityType: "group",
    entityId: group.id,
    before: before as never,
    after: { name: group.name, ownerDepartmentId: group.ownerDepartmentId } as never,
  });

  return NextResponse.json({ data: group });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const denied = await getGroupOrDeny(_request, userId, resolvedParams.id, organizationId);
  if (denied) return denied;

  const result = await deleteGroup(resolvedParams.id, userId);
  if (!result) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: { success: true, usersAffected: result.usersAffected } });
}
