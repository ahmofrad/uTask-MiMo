import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { emitToProject } from "@/lib/realtime/server";
import { listTasks, createTask } from "@/lib/tasks";
import { WbsGuardError } from "@/lib/tasks/wbs";
import { mapAssignees } from "@/lib/tasks/serialize";
import { checkIdempotency, setIdempotencyResult, acquirePending, releasePending } from "@/lib/idempotency";
import type { ListTasksParams, CreateTaskData } from "@/lib/tasks";

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

  // Scope to user's projects unless they have global task:edit_any
  if (projectId) {
    params.projectId = projectId;
  } else if (!(await can(userId, "task:edit_any"))) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = memberships.map((m) => m.projectId);
    if (projectIds.length === 0) {
      return NextResponse.json({ data: [], meta: { nextCursor: null, hasMore: false } });
    }
    params.projectIds = projectIds;
  }

  const result = await listTasks(params);
  const data = result.data.map((task) => ({ ...task, assignees: mapAssignees((task as { assignees?: unknown }).assignees as never) }));

  return NextResponse.json({ data, meta: result.meta });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Idempotency check
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey);
    if (cached.hit) {
      return NextResponse.json(cached.response.body, { status: cached.response.status });
    }
    if (!(await acquirePending(idempotencyKey))) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Request already in progress" } },
        { status: 409 },
      );
    }
  }

  try {
    const body = await request.json();
    const {
      projectId, title, description, parentTaskId,
      status: taskStatus, priority: taskPriority,
      startDate, dueDate, assigneeId, assigneeIds, estimatedHours, progress,
      customFields, tagIds,
    } = body as Record<string, unknown>;

    if (!projectId || !title) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "projectId and title are required" } },
        { status: 400 },
      );
    }

    const projectPermitted = await canProject(userId, "task:create", String(projectId));
    if (!projectPermitted) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient project permissions" } }, { status: 403 });
    }

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

    await emitTaskEvent("task.created", task.id, { id: task.id, title: task.title, projectId: task.projectId }, userId);
    emitToProject(task.projectId, "task.created", { id: task.id, title: task.title, projectId: task.projectId });

    const responseBody = { data: task };

    if (idempotencyKey) {
      await setIdempotencyResult(idempotencyKey, 201, responseBody);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } finally {
    if (idempotencyKey) await releasePending(idempotencyKey);
  }
}