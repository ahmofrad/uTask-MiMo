import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { addDependency, listDependencies, DependencyError } from "@/lib/tasks";
import { prisma } from "@/lib/db";
import { dependencyCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

async function taskBelongsToProject(projectId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, deletedAt: true },
  });
  return task !== null && task.deletedAt === null && task.projectId === projectId;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await taskBelongsToProject(resolvedParams.projectId, resolvedParams.taskId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  const permitted =
    (await canProject(userId, "task:edit_any", resolvedParams.projectId)) ||
    (await canProject(userId, "task:edit_own", resolvedParams.projectId)) ||
    (await canProject(userId, "comment:create", resolvedParams.projectId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const deps = await listDependencies(resolvedParams.taskId);
  return NextResponse.json({ data: deps });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await taskBelongsToProject(resolvedParams.projectId, resolvedParams.taskId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  const permitted = await canProject(userId, "task:edit_any", resolvedParams.projectId);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const parsed = dependencyCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  try {
    const input: Parameters<typeof addDependency>[0] = {
      taskId: resolvedParams.taskId,
      dependsOnId: body.dependsOnId,
      createdBy: userId,
    };
    if (body.type) input.type = body.type;
    if (body.lag !== undefined) input.lag = body.lag;
    if (body.lagUnit) input.lagUnit = body.lagUnit;
    const edge = await addDependency(input);

    await logAudit({
      actorUserId: userId,
      action: "task_dependency_created",
      entityType: "taskDependency",
      entityId: edge.id,
      after: edge as never,
    });

    return NextResponse.json({ data: edge }, { status: 201 });
  } catch (err) {
    if (err instanceof DependencyError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        { status: err.status },
      );
    }
    throw err;
  }
}