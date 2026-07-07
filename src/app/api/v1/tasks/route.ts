import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { listTasks, createTask } from "@/lib/tasks";
import { checkIdempotency, setIdempotencyResult } from "@/lib/idempotency";
import type { ListTasksParams, CreateTaskData } from "@/lib/tasks";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const projectId = searchParams.get("projectId");
  const assigneeId = searchParams.get("assigneeId");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const search = searchParams.get("search");
  const dueDateGte = searchParams.get("dueDateGte");
  const dueDateLte = searchParams.get("dueDateLte");

  const params: ListTasksParams = { limit };
  if (cursor) params.cursor = cursor;
  if (assigneeId) params.assigneeId = assigneeId;
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

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  // Idempotency check
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    const cached = checkIdempotency(idempotencyKey);
    if (cached.hit) {
      return NextResponse.json(cached.response.body, { status: cached.response.status });
    }
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

  const projectPermitted = await canProject(session.user.id, "task:create", String(projectId));
  if (!projectPermitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient project permissions" } }, { status: 403 });
  }

  const data: CreateTaskData = {
    projectId: String(projectId),
    title: String(title),
    reporterId: session.user.id,
    createdById: session.user.id,
  };
  if (description) data.description = String(description);
  if (parentTaskId) data.parentTaskId = String(parentTaskId);
  if (taskStatus) data.status = String(taskStatus);
  if (taskPriority) data.priority = String(taskPriority);
  if (dueDate) data.dueDate = String(dueDate);
  if (assigneeId) data.assigneeId = String(assigneeId);
  if (estimatedHours) data.estimatedHours = Number(estimatedHours);
  if (customFields && typeof customFields === "object") data.customFields = customFields as Record<string, unknown>;

  const task = await createTask(data);

  await logAudit({ actorUserId: session.user.id, action: "task_created", entityType: "task", entityId: task.id, after: task as never });

  await emitTaskEvent("task.created", task.id, { id: task.id, title: task.title, projectId: task.projectId }, session.user.id);

  const responseBody = { data: task };

  if (idempotencyKey) {
    setIdempotencyResult(idempotencyKey, 201, responseBody);
  }

  return NextResponse.json(responseBody, { status: 201 });
}
