import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getUserReadableProjectIds } from "@/lib/projects/queries";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { emitToProject } from "@/lib/realtime/server";
import { listTasks, createTask } from "@/lib/tasks";
import { WbsGuardError } from "@/lib/tasks/wbs";
import { mapAssignees } from "@/lib/tasks/serialize";
import { checkIdempotency, setIdempotencyResult, acquirePending, releasePending, type IdempotencyScope } from "@/lib/idempotency";
import type { ListTasksParams, CreateTaskData } from "@/lib/tasks";
import { readJsonBody, taskCreateSchema, customFieldFilterListSchema, validationError } from "@/lib/validation/api";
import { sha256 } from "@/lib/crypto";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const projectId = searchParams.get("projectId");
  const assigneeId = searchParams.get("assigneeId");
  const assigneeIdsRaw = searchParams.get("assigneeIds");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const search = searchParams.get("search");
  const dueDateGte = searchParams.get("dueDateGte");
  const dueDateLte = searchParams.get("dueDateLte");
  const customFieldsRaw = searchParams.get("customFields");

  const params: ListTasksParams = { limit };
  if (cursor) params.cursor = cursor;
  if (assigneeIdsRaw) {
    params.assigneeIds = assigneeIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (assigneeId) {
    params.assigneeId = assigneeId;
  }
  if (status) params.status = status;
  if (priority) params.priority = priority;
  if (search) params.search = search;
  if (dueDateGte) params.dueDateGte = dueDateGte;
  if (dueDateLte) params.dueDateLte = dueDateLte;
  if (customFieldsRaw) {
    let clauses: unknown;
    try {
      clauses = JSON.parse(customFieldsRaw);
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_CUSTOM_FIELDS", message: "customFields must be valid JSON" } },
        { status: 400 },
      );
    }
    const parsed = customFieldFilterListSchema.safeParse(clauses);
    if (!parsed.success) {
      return NextResponse.json(validationError(parsed.error), { status: 400 });
    }
    params.customFields = parsed.data;
  }

  const readableProjectIds = await getUserReadableProjectIds(userId);
  if (projectId) {
    if (readableProjectIds !== null && !readableProjectIds.includes(projectId)) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not a member of this project" } }, { status: 403 });
    }
    params.projectId = projectId;
  } else if (readableProjectIds !== null) {
    params.projectIds = readableProjectIds;
  }

  const result = await listTasks(params);
  const data = result.data.map((task) => ({ ...task, assignees: mapAssignees((task as { assignees?: unknown }).assignees as never) }));

  return NextResponse.json({ data, meta: result.meta });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = taskCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const body = parsed.data;
  const {
    projectId, title, description, parentTaskId,
    status: taskStatus, priority: taskPriority,
    startDate, dueDate, assigneeId, assigneeIds, assigneeGroupId, estimatedHours, progress,
    customFields, tagIds,
  } = body;

  const projectPermitted = await canProject(userId, "task:create", String(projectId));
  if (!projectPermitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient project permissions" } }, { status: 403 });
  }

  if (assigneeGroupId) {
    const group = await prisma.ldapSyncGroup.findUnique({
      where: { id: String(assigneeGroupId) },
      select: { id: true, deletedAt: true },
    });
    if (!group || group.deletedAt) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Assignee group not found" } }, { status: 404 });
    }
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" } }, { status: 400 });
  }
  const idempotencyScope: IdempotencyScope = {
    userId,
    route: "tasks:create",
    bodyHash: sha256(JSON.stringify(body)),
  };
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
  if (cached.hit) {
    return NextResponse.json(cached.response.body, { status: cached.response.status });
  }
  const pending = await acquirePending(idempotencyKey, idempotencyScope);
  if (pending === "unavailable") {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_UNAVAILABLE", message: "Idempotency storage is unavailable" } }, { status: 503 });
  }
  if (pending !== "acquired") {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Request already in progress" } },
      { status: 409 },
    );
  }

  try {
    const data: CreateTaskData = {
      projectId: String(projectId),
      title: String(title),
      reporterId: userId,
      createdById: userId,
    };
    if (description) data.description = String(description);
    if (parentTaskId) data.parentTaskId = String(parentTaskId);
    if (taskStatus) data.status = String(taskStatus);
    if (taskPriority) data.priority = String(taskPriority);
    if (startDate) data.startDate = String(startDate);
    if (dueDate) data.dueDate = String(dueDate);
    if (Array.isArray(assigneeIds)) {
      data.assigneeIds = assigneeIds as string[];
    } else if (assigneeId) {
      data.assigneeIds = [String(assigneeId)];
    }
    if (assigneeGroupId !== undefined) data.assigneeGroupId = assigneeGroupId === null ? null : String(assigneeGroupId);
    if (estimatedHours) data.estimatedHours = Number(estimatedHours);
    if (progress !== undefined) data.progress = Number(progress);
    if (customFields && typeof customFields === "object") data.customFields = customFields as Record<string, unknown>;
    if (tagIds && Array.isArray(tagIds)) data.tagIds = tagIds as string[];

    let task: Awaited<ReturnType<typeof createTask>>;
    try {
      task = await createTask(data);
    } catch (err) {
      if (err instanceof WbsGuardError) {
        const status = err.code === "CYCLE" ? 409 : 400;
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status },
        );
      }
      throw err;
    }

    await logAudit({ actorUserId: userId, action: "task_created", entityType: "task", entityId: task.id, after: task as never });

    if (data.assigneeGroupId) {
      await logAudit({
        actorUserId: userId,
        action: "task_group_assigned",
        entityType: "task",
        entityId: task.id,
        after: { assigneeGroupId: data.assigneeGroupId, taskTitle: task.title },
      });
    }

    await emitTaskEvent("task.created", task.id, { id: task.id, title: task.title, projectId: task.projectId }, userId);
    emitToProject(task.projectId, "task.created", { id: task.id, title: task.title, projectId: task.projectId });

    const responseBody = { data: task };

    if (idempotencyKey) {
      await setIdempotencyResult(idempotencyKey, 201, responseBody, idempotencyScope);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } finally {
    if (idempotencyKey) await releasePending(idempotencyKey, idempotencyScope);
  }
}