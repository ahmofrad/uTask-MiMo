import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { moveTask } from "@/lib/tasks";
import type { MoveTaskData } from "@/lib/tasks";
import { WbsGuardError } from "@/lib/tasks/wbs";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const userId = session.user.id;
  const taskId = params.id;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, deletedAt: true },
  });
  if (!task || task.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  const permitted = await canProject(userId, "task:edit_any", task.projectId);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = (await request.json()) as { newParentId?: string | null; position?: number };

  const moveData: MoveTaskData = {};
  if (body.newParentId !== undefined) moveData.newParentId = body.newParentId;
  if (body.position !== undefined) moveData.position = body.position;

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
