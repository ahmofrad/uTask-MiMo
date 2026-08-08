import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canReadTask, canEditTask } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { emitToProject, emitToTask } from "@/lib/realtime/server";
import { getTaskById, updateTask, deleteTask, DependencyBlockedError } from "@/lib/tasks";
import { mapAssignees } from "@/lib/tasks/serialize";
import { getCustomFieldValuesForTask as getFieldValues } from "@/lib/custom-fields/values";
import type { UpdateTaskData } from "@/lib/tasks";
import { readJsonBody, taskUpdateSchema, validationError } from "@/lib/validation/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const task = await getTaskById(resolvedParams.id);

  if (!task) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  const hasAccess = await canReadTask(userId, resolvedParams.id);

  if (!hasAccess) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  return NextResponse.json({
    data: {
      ...task,
      assignees: mapAssignees(task.assignees),
      subtasks: (task.subtasks ?? []).map((st) => ({ ...st, assignees: mapAssignees(st.assignees) })),
    },
  });
}

async function checkTaskPermission(userId: string, taskId: string): Promise<boolean> {
  return canEditTask(userId, taskId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!await checkTaskPermission(userId, resolvedParams.id)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const parsed = taskUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const body = parsed.data;
  const {
    title, description, status: taskStatus, priority: taskPriority,
    startDate, endDate, dueDate, assigneeId, assigneeIds, estimatedHours, spentHours, progress,
    deletedAt,
    customFields, tagIds,
  } = body;

  const data: UpdateTaskData = {};
  if (title !== undefined) data.title = String(title);
  if (description !== undefined) data.description = description === null ? null : String(description);
  if (taskStatus !== undefined) data.status = String(taskStatus);
  if (taskPriority !== undefined) data.priority = String(taskPriority);
  if (startDate !== undefined) data.startDate = startDate === null ? null : String(startDate);
  if (endDate !== undefined) data.endDate = endDate === null ? null : String(endDate);
  if (dueDate !== undefined) data.dueDate = dueDate === null ? null : String(dueDate);
  if (assigneeIds !== undefined) {
    data.assigneeIds = Array.isArray(assigneeIds) ? (assigneeIds as string[]) : [];
  } else if (assigneeId !== undefined) {
    data.assigneeIds = assigneeId === null ? [] : [String(assigneeId)];
  }
  if (estimatedHours !== undefined) data.estimatedHours = estimatedHours === null ? null : Number(estimatedHours);
  if (spentHours !== undefined) data.spentHours = spentHours === null ? null : Number(spentHours);
  if (progress !== undefined) data.progress = Number(progress);
  if (deletedAt !== undefined) data.deletedAt = deletedAt === null ? null : String(deletedAt);
  if (customFields && typeof customFields === "object") data.customFields = customFields as Record<string, unknown>;
  if (tagIds && Array.isArray(tagIds)) data.tagIds = tagIds as string[];

  let before: Awaited<ReturnType<typeof updateTask>>["before"];
  let task: Awaited<ReturnType<typeof updateTask>>["task"];
  try {
    const result = await updateTask(resolvedParams.id, data, userId);
    before = result.before;
    task = result.task;
  } catch (err) {
    if (err instanceof DependencyBlockedError) {
      return NextResponse.json(
        { error: { code: "DEPENDENCY_BLOCKED", message: err.message, details: err.blockers } },
        { status: 403 },
      );
    }
    throw err;
  }

  await logAudit({ actorUserId: userId, action: "task_updated", entityType: "task", entityId: task.id, before: before as never, after: task as never });

  await emitTaskEvent("task.updated", task.id, { id: task.id, title: task.title, projectId: task.projectId }, userId);
  emitToProject(task.projectId, "task.updated", { id: task.id, title: task.title, projectId: task.projectId });
  emitToTask(task.id, "task.updated", { id: task.id, title: task.title, projectId: task.projectId });

  // Include custom field values in response so client can update immediately
  const customFieldValues = await getFieldValues(resolvedParams.id);

  const { logger } = await import("@/lib/logging");
  logger.info({ taskId: resolvedParams.id, customFieldValues, hasCustomFields: !!data.customFields }, "PATCH task with custom fields");

  return NextResponse.json({ data: { ...task, customFields: customFieldValues } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!await checkTaskPermission(userId, resolvedParams.id)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const { before } = await deleteTask(resolvedParams.id);

  await logAudit({ actorUserId: userId, action: "task_deleted", entityType: "task", entityId: resolvedParams.id, before: before as never });

  await emitTaskEvent("task.deleted", resolvedParams.id, { id: resolvedParams.id }, userId);
  if (before?.projectId) {
    emitToProject(before.projectId, "task.deleted", { id: resolvedParams.id, projectId: before.projectId });
  }

  return NextResponse.json({ data: { success: true } });
}