import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { isTaskFinalizer, TaskNotPendingApprovalError, approveTask } from "@/lib/tasks";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { emitToProject, emitToTask } from "@/lib/realtime/server";
import { approvalDecisionSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const task = await prisma.task.findUnique({ where: { id: resolvedParams.id } });
  if (!task || task.deletedAt) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Task not found" } },
      { status: 404 },
    );
  }
  if (task.status !== "pending_approval") {
    return NextResponse.json(
      { error: { code: "NOT_PENDING_APPROVAL", message: "Task is not awaiting approval" } },
      { status: 409 },
    );
  }

  const isFinalizer = await isTaskFinalizer(userId, {
    projectId: task.projectId,
    approverId: task.approverId,
  });
  if (!isFinalizer) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const body = (await readJsonBody(request)) ?? {};
  const parsed = approvalDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  let result: Awaited<ReturnType<typeof approveTask>>;
  try {
    result = await approveTask(resolvedParams.id, userId);
  } catch (err) {
    if (err instanceof TaskNotPendingApprovalError) {
      return NextResponse.json(
        { error: { code: "NOT_PENDING_APPROVAL", message: "Task is not awaiting approval" } },
        { status: 409 },
      );
    }
    throw err;
  }
  const { before, task: updated } = result;

  await logAudit({
    actorUserId: userId,
    action: "task_approved",
    entityType: "task",
    entityId: updated.id,
    before: before as never,
    after: updated as never,
  });

  await emitTaskEvent(
    "task.updated",
    updated.id,
    { id: updated.id, title: updated.title, projectId: updated.projectId },
    userId,
  );
  emitToProject(updated.projectId, "task.updated", {
    id: updated.id,
    title: updated.title,
    projectId: updated.projectId,
    actorUserId: userId,
  });
  emitToTask(updated.id, "task.updated", {
    id: updated.id,
    title: updated.title,
    projectId: updated.projectId,
  });

  return NextResponse.json({ data: updated });
}
