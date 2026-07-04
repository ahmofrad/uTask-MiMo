import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await authenticatePublicApi(request, "tasks:read");
  if (error) return error;

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
