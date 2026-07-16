import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { mapAssignees } from "@/lib/tasks/serialize";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const subtasks = await prisma.task.findMany({
    where: { parentTaskId: resolvedParams.id, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
  });

  const data = subtasks.map((st) => ({ ...st, assignees: mapAssignees(st.assignees) }));

  return NextResponse.json({ data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { title } = body as { title?: string };

  if (!title?.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "title is required" } },
      { status: 400 },
    );
  }

  const parent = await prisma.task.findUnique({ where: { id: resolvedParams.id } });
  if (!parent) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const subtask = await prisma.task.create({
    data: {
      title: title.trim(),
      projectId: parent.projectId,
      parentTaskId: resolvedParams.id,
      status: "open",
      priority: "med",
      reporterId: userId,
      createdById: userId,
      orderIndex: 0,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "created",
    entityType: "task",
    entityId: subtask.id,
    after: { title: subtask.title, parentTaskId: resolvedParams.id },
  });

  await emitTaskEvent("subtask.created", subtask.id, { id: subtask.id, title: subtask.title, parentTaskId: resolvedParams.id }, userId);

  return NextResponse.json({ data: subtask }, { status: 201 });
}

