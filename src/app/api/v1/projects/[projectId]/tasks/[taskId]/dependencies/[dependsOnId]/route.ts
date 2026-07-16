import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { removeDependency, DependencyError, type DependencyTypeValue } from "@/lib/tasks";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; taskId: string; dependsOnId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const permitted = await canProject(userId, "task:edit_any", resolvedParams.projectId);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const url = new URL(_request.url);
  const typeParam = url.searchParams.get("type") as DependencyTypeValue | null;

  try {
    await removeDependency(resolvedParams.taskId, resolvedParams.dependsOnId, typeParam ?? undefined);

    await logAudit({
      actorUserId: userId,
      action: "task_dependency_deleted",
      entityType: "taskDependency",
      entityId: `${resolvedParams.taskId}:${resolvedParams.dependsOnId}`,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    if (err instanceof DependencyError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    throw err;
  }
}