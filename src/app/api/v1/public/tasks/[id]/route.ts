import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { canEditTask, canReadTask } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { mapAssignees } from "@/lib/tasks/serialize";
import { updateTask, deleteTask, DependencyBlockedError } from "@/lib/tasks";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { emitToProject } from "@/lib/realtime/server";
import { publicTaskUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

async function checkProjectAccess(userId: string, taskId: string, mode: "read" | "write" = "write"): Promise<{ allowed: boolean; projectId: string | undefined }> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true, deletedAt: true } });
  if (!task) return { allowed: false, projectId: undefined };
  if (task.deletedAt) return { allowed: false, projectId: task.projectId };
  const allowed = mode === "read" ? await canReadTask(userId, taskId) : await canEditTask(userId, taskId);
  return { allowed, projectId: task.projectId };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request, "tasks:read");
  if (error) return error;

  const access = await checkProjectAccess(userId, resolvedParams.id, "read");
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const task = await prisma.task.findUnique({
    where: { id: resolvedParams.id },
    include: {
      project: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ data: { ...task, assignees: mapAssignees(task.assignees) } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request, "tasks:write");
  if (error) return error;

  const access = await checkProjectAccess(userId, resolvedParams.id);
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const parsed = publicTaskUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const input = parsed.data;
  const assigneeIds = input.assigneeIds ?? (input.assigneeId !== undefined ? (input.assigneeId ? [input.assigneeId] : []) : undefined);

  let result: Awaited<ReturnType<typeof updateTask>>;
  try {
    result = await updateTask(resolvedParams.id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(assigneeIds !== undefined ? { assigneeIds } : {}),
    }, userId);
  } catch (err) {
    if (err instanceof DependencyBlockedError) {
      return NextResponse.json({ error: { code: "DEPENDENCY_BLOCKED", message: err.message } }, { status: 409 });
    }
    throw err;
  }

  const { before, task, autoScheduled } = result;
  await logAudit({
    actorUserId: userId,
    action: "task_updated",
    entityType: "task",
    entityId: resolvedParams.id,
    before: before as never,
    after: task as never,
  });
  await emitTaskEvent("task.updated", task.id, { id: task.id, title: task.title, projectId: task.projectId }, userId);
  emitToProject(task.projectId, "task.updated", { id: task.id, title: task.title, projectId: task.projectId });

  return NextResponse.json({ data: { ...task, autoScheduled } });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request, "tasks:write");
  if (error) return error;

  const access = await checkProjectAccess(userId, resolvedParams.id);
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const existing = await prisma.task.findUnique({ where: { id: resolvedParams.id }, select: { id: true, deletedAt: true, projectId: true } });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const { before } = await deleteTask(resolvedParams.id);

  await logAudit({
    actorUserId: userId,
    action: "task_deleted",
    entityType: "task",
    entityId: resolvedParams.id,
    before: before as never,
  });
  await emitTaskEvent("task.deleted", resolvedParams.id, { id: resolvedParams.id, projectId: existing.projectId }, userId);
  emitToProject(existing.projectId, "task.deleted", { id: resolvedParams.id, projectId: existing.projectId });

  return NextResponse.json({ data: { success: true } });
}
