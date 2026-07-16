import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; userId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const permitted = await can(userId, "user:manage") ||
    await canProject(userId, "project_role:assign", resolvedParams.projectId);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: resolvedParams.projectId, userId: resolvedParams.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User is not a member of this project" } }, { status: 404 });
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: resolvedParams.projectId, userId: resolvedParams.userId } },
  });

  await logAudit({
    actorUserId: userId,
    action: "project_member_removed",
    entityType: "projectMember",
    entityId: `${resolvedParams.projectId}:${resolvedParams.userId}`,
    before: membership as never,
  });

  return NextResponse.json({ data: { success: true } });
}