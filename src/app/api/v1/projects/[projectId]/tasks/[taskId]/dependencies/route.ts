import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { addDependency, listDependencies, DependencyError, type DependencyTypeValue } from "@/lib/tasks";

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string; taskId: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const permitted =
    (await canProject(userId, "task:edit_any", params.projectId)) ||
    (await canProject(userId, "task:edit_own", params.projectId)) ||
    (await canProject(userId, "comment:create", params.projectId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const deps = await listDependencies(params.taskId);
  return NextResponse.json({ data: deps });
}

export async function POST(
  request: Request,
  { params }: { params: { projectId: string; taskId: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const permitted = await canProject(userId, "task:edit_any", params.projectId);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = (await request.json()) as {
    dependsOnId?: string;
    type?: DependencyTypeValue;
    lag?: number;
    lagUnit?: "DAY" | "HOUR";
  };

  if (!body.dependsOnId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "dependsOnId is required" } }, { status: 400 });
  }

  try {
    const input: Parameters<typeof addDependency>[0] = {
      taskId: params.taskId,
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