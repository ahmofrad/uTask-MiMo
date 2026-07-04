import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      reporter: { select: { id: true, displayName: true, email: true } },
      createdBy: { select: { id: true, displayName: true } },
      parentTask: { select: { id: true, title: true } },
      subtasks: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true, status: true, priority: true, assigneeId: true },
      },
      tags: { include: { tag: true } },
      _count: { select: { comments: true, attachments: true, watchers: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  const customFields = await prisma.customFieldValue.findMany({
    where: { taskId: params.id },
    include: { customField: true },
  });

  const customFieldsMap: Record<string, unknown> = {};
  for (const cfv of customFields) {
    customFieldsMap[cfv.customField.key] =
      cfv.valueText ?? cfv.valueNumber ?? cfv.valueDate ?? cfv.valueBool ?? cfv.valueJson ?? null;
  }

  return NextResponse.json({ data: { ...task, customFields: customFieldsMap } });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const {
    title, description, status: taskStatus, priority: taskPriority,
    dueDate, assigneeId, estimatedHours, spentHours, parentTaskId,
    deletedAt,
    customFields,
  } = body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (taskStatus !== undefined) updateData.status = taskStatus;
  if (taskPriority !== undefined) updateData.priority = taskPriority;
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(String(dueDate)) : null;
  if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
  if (estimatedHours !== undefined) updateData.estimatedHours = estimatedHours ? Number(estimatedHours) : null;
  if (spentHours !== undefined) updateData.spentHours = spentHours ? Number(spentHours) : null;
  if (parentTaskId !== undefined) updateData.parentTaskId = parentTaskId;
  if (deletedAt !== undefined) updateData.deletedAt = deletedAt === null ? null : new Date(String(deletedAt));

  if (taskStatus === "done") {
    updateData.completedAt = new Date();
  }

  const before = await prisma.task.findUnique({ where: { id: params.id } });

  const task = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
  });

  await logAudit({ actorUserId: session.user.id, action: "task_updated", entityType: "task", entityId: task.id, before: before as never, after: task as never });

  await emitTaskEvent("task.updated", task.id, { id: task.id, title: task.title, projectId: task.projectId }, session.user.id);

  if (customFields && typeof customFields === "object") {
    const { setCustomFieldValues } = await import("@/lib/custom-fields/values");
    const fullTask = await prisma.task.findUnique({ where: { id: params.id }, select: { projectId: true } });
    if (fullTask) {
      await setCustomFieldValues(params.id, fullTask.projectId, customFields as Record<string, unknown>);
    }
  }

  return NextResponse.json({ data: task });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const before = await prisma.task.findUnique({ where: { id: params.id } });

  await prisma.task.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({ actorUserId: session.user.id, action: "task_deleted", entityType: "task", entityId: params.id, before: before as never });

  await emitTaskEvent("task.deleted", params.id, { id: params.id }, session.user.id);

  return NextResponse.json({ data: { success: true } });
}
