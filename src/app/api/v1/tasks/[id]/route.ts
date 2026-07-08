import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can, canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { getTaskById, updateTask, deleteTask } from "@/lib/tasks";
import { getCustomFieldValuesForTask as getFieldValues } from "@/lib/custom-fields/values";
import type { UpdateTaskData } from "@/lib/tasks";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const task = await getTaskById(params.id);

  if (!task) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  // Verify user has access to this task's project
  const userId = session.user.id;
  const hasAccess =
    await can(userId, "task:edit_any") ||
    await canProject(userId, "task:edit_any", task.projectId) ||
    await canProject(userId, "task:edit_own", task.projectId) ||
    await canProject(userId, "comment:create", task.projectId);

  if (!hasAccess) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  return NextResponse.json({ data: task });
}

async function checkTaskPermission(userId: string, taskId: string): Promise<boolean> {
  if (await can(userId, "task:edit_any")) return true;
  const task = await getTaskById(taskId);
  return task ? canProject(userId, "task:edit_any", task.projectId) : false;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const userId = session.user.id;
  if (!await checkTaskPermission(userId, params.id)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const {
    title, description, status: taskStatus, priority: taskPriority,
    dueDate, assigneeId, estimatedHours, spentHours, parentTaskId,
    deletedAt,
    customFields,
  } = body as Record<string, unknown>;

  const data: UpdateTaskData = {};
  if (title !== undefined) data.title = String(title);
  if (description !== undefined) data.description = description === null ? null : String(description);
  if (taskStatus !== undefined) data.status = String(taskStatus);
  if (taskPriority !== undefined) data.priority = String(taskPriority);
  if (dueDate !== undefined) data.dueDate = dueDate === null ? null : String(dueDate);
  if (assigneeId !== undefined) data.assigneeId = assigneeId === null ? null : String(assigneeId);
  if (estimatedHours !== undefined) data.estimatedHours = estimatedHours === null ? null : Number(estimatedHours);
  if (spentHours !== undefined) data.spentHours = spentHours === null ? null : Number(spentHours);
  if (parentTaskId !== undefined) data.parentTaskId = parentTaskId === null ? null : String(parentTaskId);
  if (deletedAt !== undefined) data.deletedAt = deletedAt === null ? null : String(deletedAt);
  if (customFields && typeof customFields === "object") data.customFields = customFields as Record<string, unknown>;

  const { before, task } = await updateTask(params.id, data);

  await logAudit({ actorUserId: userId, action: "task_updated", entityType: "task", entityId: task.id, before: before as never, after: task as never });

  await emitTaskEvent("task.updated", task.id, { id: task.id, title: task.title, projectId: task.projectId }, userId);

  // Include custom field values in response so client can update immediately
  const customFieldValues = await getFieldValues(params.id);

  const { logger } = await import("@/lib/logging");
  logger.info({ taskId: params.id, customFieldValues, hasCustomFields: !!data.customFields }, "PATCH task with custom fields");

  return NextResponse.json({ data: { ...task, customFields: customFieldValues } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const userId = session.user.id;
  if (!await checkTaskPermission(userId, params.id)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const { before } = await deleteTask(params.id);

  await logAudit({ actorUserId: userId, action: "task_deleted", entityType: "task", entityId: params.id, before: before as never });

  await emitTaskEvent("task.deleted", params.id, { id: params.id }, userId);

  return NextResponse.json({ data: { success: true } });
}
