import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function GET(request: Request) {
  const { error } = await authenticatePublicApi(request, "tasks:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const projectId = searchParams.get("projectId");
  const assigneeId = searchParams.get("assigneeId");

  const where: Record<string, unknown> = { deletedAt: null };
  if (projectId) where.projectId = projectId;
  if (assigneeId) where.assigneeId = assigneeId;

  const tasks = await prisma.task.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, description: true, status: true, priority: true,
      dueDate: true, projectId: true, assigneeId: true, reporterId: true,
      estimatedHours: true, spentHours: true, createdAt: true, updatedAt: true,
    },
  });

  const hasMore = tasks.length > limit;
  if (hasMore) tasks.pop();
  const lastItem = tasks[tasks.length - 1];

  return NextResponse.json({
    data: tasks,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  });
}

export async function POST(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "tasks:write");
  if (error) return error;

  const body = await request.json();
  const { projectId, title, description, status, priority, dueDate, assigneeId } = body as Record<string, unknown>;

  if (!projectId || !title) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId and title are required" } },
      { status: 400 },
    );
  }

  const allowed =
    (await can(userId, "task:edit_any")) ||
    (await canProject(userId, "task:edit_any", String(projectId))) ||
    (await canProject(userId, "task:edit_own", String(projectId)));
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not a member of this project" } },
      { status: 403 },
    );
  }

  const task = await prisma.task.create({
    data: {
      projectId: String(projectId),
      title: String(title),
      description: description ? String(description) : null,
      status: (status as never) ?? "open",
      priority: (priority as never) ?? "med",
      dueDate: dueDate ? new Date(String(dueDate)) : null,
      assigneeId: assigneeId ? String(assigneeId) : null,
      reporterId: userId,
      createdById: userId,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "task_created",
    entityType: "task",
    entityId: task.id,
    after: task as never,
  });

  return NextResponse.json({ data: task }, { status: 201 });
}
