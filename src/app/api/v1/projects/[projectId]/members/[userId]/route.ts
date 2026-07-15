import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string; userId: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const permitted = await can(userId, "user:manage") ||
    await canProject(userId, "project_role:assign", params.projectId);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: params.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User is not a member of this project" } }, { status: 404 });
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: params.projectId, userId: params.userId } },
  });

  await logAudit({
    actorUserId: userId,
    action: "project_member_removed",
    entityType: "projectMember",
    entityId: `${params.projectId}:${params.userId}`,
    before: membership as never,
  });

  return NextResponse.json({ data: { success: true } });
}