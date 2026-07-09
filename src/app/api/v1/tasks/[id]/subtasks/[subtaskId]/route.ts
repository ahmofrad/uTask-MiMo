import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; subtaskId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { status, title } = body as { status?: string; title?: string };

  if (!status && !title) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "status or title is required" } },
      { status: 400 },
    );
  }

  const before = await prisma.task.findUnique({ where: { id: params.subtaskId } });

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (title !== undefined) updateData.title = title;
  if (status === "done") updateData.completedAt = new Date();

  const subtask = await prisma.task.update({
    where: { id: params.subtaskId, parentTaskId: params.id },
    data: updateData,
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "updated",
    entityType: "task",
    entityId: subtask.id,
    before,
    after: subtask,
  });

  await emitTaskEvent("subtask.updated", subtask.id, { id: subtask.id, title: subtask.title, status: subtask.status }, session.user.id);

  return NextResponse.json({ data: subtask });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; subtaskId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const before = await prisma.task.findUnique({ where: { id: params.subtaskId } });

  await prisma.task.update({
    where: { id: params.subtaskId, parentTaskId: params.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "deleted",
    entityType: "task",
    entityId: params.subtaskId,
    before,
  });

  await emitTaskEvent("subtask.deleted", params.subtaskId, { id: params.subtaskId, parentTaskId: params.id }, session.user.id);

  return NextResponse.json({ data: { success: true } });
}
