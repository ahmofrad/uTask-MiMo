import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadTask } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { mapAssignees } from "@/lib/tasks/serialize";
import { readJsonBody, subtaskCreateSchema, validationError } from "@/lib/validation/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  if (!(await canReadTask(authResult.userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

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

  const parsed = subtaskCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { title } = parsed.data;

  const parent = await prisma.task.findUnique({ where: { id: resolvedParams.id } });
  if (!parent || parent.deletedAt || !(await canReadTask(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  if (!(await canProject(userId, "task:edit_any", parent.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
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

