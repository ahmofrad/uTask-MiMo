import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const projectId = searchParams.get("projectId");
  const assigneeId = searchParams.get("assigneeId");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = { deletedAt: null };
  if (projectId) where.projectId = projectId;
  if (assigneeId) where.assigneeId = assigneeId;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const tasks = await prisma.task.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { orderIndex: "asc" },
    include: {
      assignee: { select: { id: true, displayName: true, email: true } },
      reporter: { select: { id: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true, attachments: true, subtasks: true } },
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:create");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const {
    projectId, title, description, parentTaskId,
    status: taskStatus, priority: taskPriority,
    dueDate, assigneeId, estimatedHours,
    customFields,
  } = body as Record<string, unknown>;

  if (!projectId || !title) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId and title are required" } },
      { status: 400 },
    );
  }

  const maxOrder = await prisma.task.aggregate({
    where: { projectId: String(projectId) },
    _max: { orderIndex: true },
  });

  const task = await prisma.task.create({
    data: {
      projectId: String(projectId),
      title: String(title),
      description: description ? String(description) : null,
      parentTaskId: parentTaskId ? String(parentTaskId) : null,
      status: (taskStatus as never) ?? "open",
      priority: (taskPriority as never) ?? "med",
      dueDate: dueDate ? new Date(String(dueDate)) : null,
      assigneeId: assigneeId ? String(assigneeId) : null,
      reporterId: session.user.id,
      createdById: session.user.id,
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      orderIndex: Number(maxOrder._max.orderIndex ?? 0) + 1000,
    },
  });

  if (customFields && typeof customFields === "object") {
    const { setCustomFieldValues } = await import("@/lib/custom-fields/values");
    await setCustomFieldValues(task.id, String(projectId), customFields as Record<string, unknown>);
  }

  await logAudit({ actorUserId: session.user.id, action: "task_created", entityType: "task", entityId: task.id, after: task as never });

  await emitTaskEvent("task.created", task.id, { id: task.id, title: task.title, projectId: task.projectId }, session.user.id);

  return NextResponse.json({ data: task }, { status: 201 });
}
