import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "user:manage") ||
    await canProject(session.user.id, "project_role:assign", params.id);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: params.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User is not a member of this project" } }, { status: 404 });
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: params.id, userId: params.userId } },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "project_member_removed",
    entityType: "projectMember",
    entityId: `${params.id}:${params.userId}`,
    before: membership as never,
  });

  return NextResponse.json({ data: { success: true } });
}