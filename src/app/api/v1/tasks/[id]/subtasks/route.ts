import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
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

  const subtasks = await prisma.task.findMany({
    where: { parentTaskId: params.id, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: { id: true, title: true, status: true, priority: true, assigneeId: true },
  });

  return NextResponse.json({ data: subtasks });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { title } = body as { title?: string };

  if (!title?.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "title is required" } },
      { status: 400 },
    );
  }

  const parent = await prisma.task.findUnique({ where: { id: params.id } });
  if (!parent) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const subtask = await prisma.task.create({
    data: {
      title: title.trim(),
      projectId: parent.projectId,
      parentTaskId: params.id,
      status: "open",
      priority: "med",
      reporterId: session.user.id,
      createdById: session.user.id,
      orderIndex: 0,
    },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "created",
    entityType: "task",
    entityId: subtask.id,
    after: { title: subtask.title, parentTaskId: params.id },
  });

  await emitTaskEvent("subtask.created", subtask.id, { id: subtask.id, title: subtask.title, parentTaskId: params.id }, session.user.id);

  return NextResponse.json({ data: subtask }, { status: 201 });
}
