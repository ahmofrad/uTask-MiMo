import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

async function checkProjectAccess(userId: string, taskId: string): Promise<{ allowed: boolean; projectId: string | undefined }> {
  if (await can(userId, "task:edit_any")) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
    return { allowed: true, projectId: task?.projectId };
  }
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return { allowed: false, projectId: undefined };
  const allowed = await canProject(userId, "task:edit_any", task.projectId) ||
    await canProject(userId, "task:edit_own", task.projectId);
  return { allowed, projectId: task.projectId };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { userId, error } = await authenticatePublicApi(request, "tasks:read");
  if (error) return error;

  const access = await checkProjectAccess(userId, params.id);
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "No access to this task's project" } }, { status: 403 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, displayName: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ data: task });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { userId, error } = await authenticatePublicApi(request, "tasks:write");
  if (error) return error;

  const access = await checkProjectAccess(userId, params.id);
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "No access to this task's project" } }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, status, priority, dueDate, assigneeId } = body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority;
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(String(dueDate)) : null;
  if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

  const before = await prisma.task.findUnique({ where: { id: params.id } });

  const task = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
  });

  await logAudit({
    actorUserId: userId,
    action: "task_updated",
    entityType: "task",
    entityId: params.id,
    before: before as never,
    after: task as never,
  });

  return NextResponse.json({ data: task });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { userId, error } = await authenticatePublicApi(request, "tasks:write");
  if (error) return error;

  const access = await checkProjectAccess(userId, params.id);
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "No access to this task's project" } }, { status: 403 });
  }

  const before = await prisma.task.findUnique({ where: { id: params.id } });

  await prisma.task.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: userId,
    action: "task_deleted",
    entityType: "task",
    entityId: params.id,
    before: before as never,
  });

  return NextResponse.json({ data: { success: true } });
}
