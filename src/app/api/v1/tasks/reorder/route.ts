import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { reorderTasks } from "@/lib/tasks";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { projectId, taskIds } = body as { projectId?: string; taskIds?: string[] };

  if (!projectId || !taskIds || !Array.isArray(taskIds) || taskIds.length < 2) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId and taskIds array (min 2) required" } },
      { status: 400 },
    );
  }

  await reorderTasks(projectId, taskIds);

  await logAudit({ actorUserId: userId, action: "task_reordered", entityType: "task", entityId: projectId, after: { projectId, taskIds } as never });

  await emitTaskEvent("tasks.reordered", projectId, { projectId, taskIds }, userId);

  return NextResponse.json({ data: { success: true } });
}