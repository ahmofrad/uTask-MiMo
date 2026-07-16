import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { status, title } = body as { status?: string; title?: string };

  if (!status && !title) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "status or title is required" } },
      { status: 400 },
    );
  }

  const before = await prisma.task.findUnique({ where: { id: resolvedParams.subtaskId } });

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (title !== undefined) updateData.title = title;
  if (status === "done") updateData.completedAt = new Date();

  const subtask = await prisma.task.update({
    where: { id: resolvedParams.subtaskId, parentTaskId: resolvedParams.id },
    data: updateData,
  });

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "task",
    entityId: subtask.id,
    before,
    after: subtask,
  });

  await emitTaskEvent("subtask.updated", subtask.id, { id: subtask.id, title: subtask.title, status: subtask.status }, userId);

  return NextResponse.json({ data: subtask });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const before = await prisma.task.findUnique({ where: { id: resolvedParams.subtaskId } });

  await prisma.task.update({
    where: { id: resolvedParams.subtaskId, parentTaskId: resolvedParams.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: userId,
    action: "deleted",
    entityType: "task",
    entityId: resolvedParams.subtaskId,
    before,
  });

  await emitTaskEvent("subtask.deleted", resolvedParams.subtaskId, { id: resolvedParams.subtaskId, parentTaskId: resolvedParams.id }, userId);

  return NextResponse.json({ data: { success: true } });
}