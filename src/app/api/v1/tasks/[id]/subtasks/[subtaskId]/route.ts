import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadTask } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { readJsonBody, subtaskUpdateSchema, validationError } from "@/lib/validation/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parent = await prisma.task.findUnique({
    where: { id: resolvedParams.id },
    select: { projectId: true, deletedAt: true },
  });
  if (!parent || parent.deletedAt || !(await canReadTask(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  if (!(await canProject(userId, "task:edit_any", parent.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const parsed = subtaskUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { status, title } = parsed.data;

  const before = await prisma.task.findUnique({ where: { id: resolvedParams.subtaskId } });
  if (!before || before.deletedAt || before.parentTaskId !== resolvedParams.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

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

  const parent = await prisma.task.findUnique({
    where: { id: resolvedParams.id },
    select: { projectId: true, deletedAt: true },
  });
  if (!parent || parent.deletedAt || !(await canReadTask(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  if (!(await canProject(userId, "task:edit_any", parent.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const before = await prisma.task.findUnique({ where: { id: resolvedParams.subtaskId } });
  if (!before || before.deletedAt || before.parentTaskId !== resolvedParams.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

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
