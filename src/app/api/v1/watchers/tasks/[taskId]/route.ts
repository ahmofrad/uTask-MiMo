import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

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

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

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

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const { removeWatcher } = await import("@/lib/watchers");
  await removeWatcher(resolvedParams.taskId, userId);
  await logAudit({ actorUserId: userId, action: "watcher_removed", entityType: "watcher", entityId: resolvedParams.taskId, after: { taskId: resolvedParams.taskId, userId } as never });
  await emitTaskEvent("watcher.removed", resolvedParams.taskId, { taskId: resolvedParams.taskId, userId }, userId);
  return NextResponse.json({ data: { success: true } });
}