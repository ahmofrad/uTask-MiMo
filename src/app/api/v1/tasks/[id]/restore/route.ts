import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const before = await prisma.task.findUnique({ where: { id: resolvedParams.id }, select: { id: true, projectId: true, deletedAt: true } });
  if (!before) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  if (!(await canProject(authResult.userId, "task:edit_any", before.projectId))) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  if (!before.deletedAt) return NextResponse.json({ data: { success: true, restored: false } });
  await prisma.task.update({ where: { id: resolvedParams.id }, data: { deletedAt: null } });
  await logAudit({ actorUserId: authResult.userId, action: "updated", entityType: "task", entityId: before.id, before, after: { deletedAt: null } });
  return NextResponse.json({ data: { success: true, restored: true } });
}
