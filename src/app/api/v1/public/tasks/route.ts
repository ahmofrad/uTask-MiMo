import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { canProject } from "@/lib/rbac";
import { sha256 } from "@/lib/crypto";
import { getUserReadableProjectIds } from "@/lib/projects/queries";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { mapAssignees } from "@/lib/tasks/serialize";
import { createTask } from "@/lib/tasks";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { emitToProject } from "@/lib/realtime/server";
import { acquirePending, checkIdempotency, releasePending, setIdempotencyResult } from "@/lib/idempotency";
import { publicTaskCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "tasks:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const projectId = searchParams.get("projectId");
  const assigneeId = searchParams.get("assigneeId");
  const assigneeIdsRaw = searchParams.get("assigneeIds");

  const readable = await getUserReadableProjectIds(userId);
  if (projectId && readable !== null && !readable.includes(projectId)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not a member of this project" } },
      { status: 403 },
    );
  }

  const where: Record<string, unknown> = { deletedAt: null };
  if (projectId) where.projectId = projectId;
  else if (readable !== null) where.projectId = { in: readable };
  if (assigneeIdsRaw) {
    where.assignees = { some: { userId: { in: assigneeIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) } } };
  } else if (assigneeId) {
    where.assignees = { some: { userId: assigneeId } };
  }

  const tasks = await prisma.task.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, description: true, status: true, priority: true,
      dueDate: true, projectId: true, reporterId: true,
      estimatedHours: true, spentHours: true, createdAt: true, updatedAt: true,
      assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
  });

  const data = tasks.map((t) => ({ ...t, assignees: mapAssignees(t.assignees) }));

  const hasMore = tasks.length > limit;
  if (hasMore) tasks.pop();
  const lastItem = tasks[tasks.length - 1];

  return NextResponse.json({
    data,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  });
}

export async function POST(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "tasks:write");
  if (error) return error;

  const parsed = publicTaskCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const input = parsed.data;

  const allowed = await canProject(userId, "task:create", input.projectId);
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not a member of this project" } },
      { status: 403 },
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey) {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" } }, { status: 400 });
  }
  const idempotencyScope = { userId, route: "public:tasks:create", bodyHash: sha256(JSON.stringify(input)) };
  const cached = await checkIdempotency(idempotencyKey, idempotencyScope);
  if (cached.unavailable) {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_UNAVAILABLE", message: "Idempotency storage is unavailable" } }, { status: 503 });
  }
  if (cached.conflict) {
    return NextResponse.json(
      { error: { code: "IDEMPOTENCY_KEY_REUSE", message: "Idempotency-Key was already used with a different request body" } },
      { status: 409 },
    );
  }
  if (cached.hit) return NextResponse.json(cached.response.body, { status: cached.response.status });
  const pending = await acquirePending(idempotencyKey, idempotencyScope);
  if (pending === "unavailable") {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_UNAVAILABLE", message: "Idempotency storage is unavailable" } }, { status: 503 });
  }
  if (pending !== "acquired") {
    return NextResponse.json({ error: { code: "REQUEST_IN_PROGRESS" } }, { status: 409 });
  }

  try {
    const assigneeIds = input.assigneeIds ?? (input.assigneeId ? [input.assigneeId] : []);
    const task = await createTask({
      projectId: input.projectId,
      title: input.title,
      assigneeIds,
      reporterId: userId,
      createdById: userId,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    });

    await logAudit({ actorUserId: userId, action: "task_created", entityType: "task", entityId: task.id, after: task as never });
    await emitTaskEvent("task.created", task.id, { id: task.id, title: task.title, projectId: task.projectId }, userId);
    emitToProject(task.projectId, "task.created", { id: task.id, title: task.title, projectId: task.projectId });

    const body = { data: task };
    await setIdempotencyResult(idempotencyKey, 201, body, idempotencyScope);
    return NextResponse.json(body, { status: 201 });
  } finally {
    await releasePending(idempotencyKey, idempotencyScope);
  }
}
