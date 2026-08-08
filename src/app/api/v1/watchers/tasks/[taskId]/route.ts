import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadTask } from "@/lib/rbac";
import { getTaskById } from "@/lib/tasks";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  if (!(await canReadTask(authResult.userId, resolvedParams.taskId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const { getWatchers } = await import("@/lib/watchers");
  const watchers = await getWatchers(resolvedParams.taskId);
  return NextResponse.json({ data: watchers });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canReadTask(userId, resolvedParams.taskId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  const task = await getTaskById(resolvedParams.taskId);
  if (!task || !(await canProject(userId, "task:edit_any", task.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { addWatcher } = await import("@/lib/watchers");
  await addWatcher(resolvedParams.taskId, userId);
  await logAudit({ actorUserId: userId, action: "watcher_added", entityType: "watcher", entityId: resolvedParams.taskId, after: { taskId: resolvedParams.taskId, userId } as never });
  await emitTaskEvent("watcher.added", resolvedParams.taskId, { taskId: resolvedParams.taskId, userId }, userId);
  return NextResponse.json({ data: { success: true } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canReadTask(userId, resolvedParams.taskId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  const task = await getTaskById(resolvedParams.taskId);
  if (!task || !(await canProject(userId, "task:edit_any", task.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { removeWatcher } = await import("@/lib/watchers");
  await removeWatcher(resolvedParams.taskId, userId);
  await logAudit({ actorUserId: userId, action: "watcher_removed", entityType: "watcher", entityId: resolvedParams.taskId, after: { taskId: resolvedParams.taskId, userId } as never });
  await emitTaskEvent("watcher.removed", resolvedParams.taskId, { taskId: resolvedParams.taskId, userId }, userId);
  return NextResponse.json({ data: { success: true } });
}
