import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { removeDependency, DependencyError, type DependencyTypeValue } from "@/lib/tasks";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; taskId: string; dependsOnId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "task:edit_any", resolvedParams.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: [resolvedParams.taskId, resolvedParams.dependsOnId] } },
    select: { id: true, projectId: true, deletedAt: true },
  });
  if (tasks.length !== 2 || tasks.some((task) => task.deletedAt || task.projectId !== resolvedParams.projectId)) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const typeParam = new URL(request.url).searchParams.get("type") as DependencyTypeValue | null;
  try {
    await removeDependency(resolvedParams.taskId, resolvedParams.dependsOnId, typeParam ?? undefined);
    await logAudit({
      actorUserId: userId,
      action: "task_dependency_deleted",
      entityType: "taskDependency",
      entityId: resolvedParams.taskId,
      after: { dependsOnTaskId: resolvedParams.dependsOnId },
    });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    if (err instanceof DependencyError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    throw err;
  }
}
