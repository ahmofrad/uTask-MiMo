import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const before = await prisma.comment.findUnique({ where: { id: resolvedParams.id }, select: { id: true, authorId: true, task: { select: { projectId: true } }, deletedAt: true } });
  if (!before) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Comment not found" } }, { status: 404 });
  if (before.authorId !== authResult.userId && !(await canProject(authResult.userId, "task:edit_any", before.task.projectId))) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  if (!before.deletedAt) return NextResponse.json({ data: { success: true, restored: false } });
  await prisma.comment.update({ where: { id: resolvedParams.id }, data: { deletedAt: null } });
  await logAudit({ actorUserId: authResult.userId, action: "updated", entityType: "comment", entityId: before.id, before: { deletedAt: before.deletedAt }, after: { deletedAt: null } });
  return NextResponse.json({ data: { success: true, restored: true } });
}
