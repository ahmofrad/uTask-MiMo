import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadTask } from "@/lib/rbac";
import { getTaskById } from "@/lib/tasks";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canReadTask(userId, resolvedParams.taskId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  const task = await getTaskById(resolvedParams.taskId);
  if (!task || !(await canProject(userId, "task:edit_any", task.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "userId is required" } }, { status: 400 });
  }

  const { removeWatcher } = await import("@/lib/watchers");
  await removeWatcher(resolvedParams.taskId, targetUserId);
  await logAudit({ actorUserId: userId, action: "watcher_removed", entityType: "watcher", entityId: resolvedParams.taskId, after: { taskId: resolvedParams.taskId, userId: targetUserId } as never });
  await emitTaskEvent("watcher.removed", resolvedParams.taskId, { taskId: resolvedParams.taskId, userId: targetUserId }, userId);
  return NextResponse.json({ data: { success: true } });
}
