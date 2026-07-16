import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { mapAssignees } from "@/lib/tasks/serialize";

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
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request, "tasks:read");
  if (error) return error;

  const access = await checkProjectAccess(userId, resolvedParams.id);
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "No access to this task's project" } }, { status: 403 });
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
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "No access to this task's project" } }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, status, priority, dueDate, assigneeId, assigneeIds } = body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority;
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(String(dueDate)) : null;
  if (assigneeIds !== undefined) {
    const next = Array.isArray(assigneeIds) ? (assigneeIds as string[]) : [];
    const current = (
      await prisma.taskAssignee.findMany({ where: { taskId: resolvedParams.id }, select: { userId: true } })
    ).map((a) => a.userId);
    const added = next.filter((uid) => !current.includes(uid));
    const removed = current.filter((uid) => !next.includes(uid));
    updateData.assignees = {
      deleteMany: { userId: { in: removed } },
      create: added.map((uid) => ({ userId: uid })),
    };
  } else if (assigneeId !== undefined) {
    const next = assigneeId ? [String(assigneeId)] : [];
    const current = (
      await prisma.taskAssignee.findMany({ where: { taskId: resolvedParams.id }, select: { userId: true } })
    ).map((a) => a.userId);
    const added = next.filter((uid) => !current.includes(uid));
    const removed = current.filter((uid) => !next.includes(uid));
    updateData.assignees = {
      deleteMany: { userId: { in: removed } },
      create: added.map((uid) => ({ userId: uid })),
    };
  }

  const before = await prisma.task.findUnique({ where: { id: resolvedParams.id } });

  const task = await prisma.task.update({
    where: { id: resolvedParams.id },
    data: updateData,
  });

  await logAudit({
    actorUserId: userId,
    action: "task_updated",
    entityType: "task",
    entityId: resolvedParams.id,
    before: before as never,
    after: task as never,
  });

  return NextResponse.json({ data: task });
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
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "No access to this task's project" } }, { status: 403 });
  }

  const before = await prisma.task.findUnique({ where: { id: resolvedParams.id } });

  await prisma.task.update({
    where: { id: resolvedParams.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: userId,
    action: "task_deleted",
    entityType: "task",
    entityId: resolvedParams.id,
    before: before as never,
  });

  return NextResponse.json({ data: { success: true } });
}
