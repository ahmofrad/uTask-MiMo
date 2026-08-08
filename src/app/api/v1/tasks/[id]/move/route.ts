import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { moveTask } from "@/lib/tasks";
import type { MoveTaskData } from "@/lib/tasks";
import { WbsGuardError } from "@/lib/tasks/wbs";
import { prisma } from "@/lib/db";
import { moveTaskSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const taskId = resolvedParams.id;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, deletedAt: true },
  });
  if (!task || task.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  const permitted =
    (await canProject(userId, "task:edit_any", task.projectId)) ||
    (await canProject(userId, "task:edit_own", task.projectId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const parsed = moveTaskSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const moveData: MoveTaskData = {};
  if (parsed.data.newParentId !== undefined) moveData.newParentId = parsed.data.newParentId;
  if (parsed.data.position !== undefined) moveData.position = parsed.data.position;

  try {
    const { before, task: updated } = await moveTask(taskId, moveData);

    await logAudit({
      actorUserId: userId,
      action: "task_moved",
      entityType: "task",
      entityId: taskId,
      before: before as never,
      after: updated as never,
    });

    await emitTaskEvent(
      "task.moved",
      taskId,
      { id: taskId, projectId: task.projectId, newParentId: updated.parentTaskId },
      userId,
    );

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof WbsGuardError) {
      const status = err.code === "CYCLE" ? 409 : 400;
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status },
      );
    }
    throw err;
  }
}