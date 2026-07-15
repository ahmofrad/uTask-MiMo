import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(
  _request: Request,
  { params }: { params: { taskId: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;

  const { getWatchers } = await import("@/lib/watchers");
  const watchers = await getWatchers(params.taskId);
  return NextResponse.json({ data: watchers });
}

export async function POST(
  _request: Request,
  { params }: { params: { taskId: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(_request, { params });
  if (guardResult) return guardResult;

  const { addWatcher } = await import("@/lib/watchers");
  await addWatcher(params.taskId, userId);
  await logAudit({ actorUserId: userId, action: "watcher_added", entityType: "watcher", entityId: params.taskId, after: { taskId: params.taskId, userId } as never });
  await emitTaskEvent("watcher.added", params.taskId, { taskId: params.taskId, userId }, userId);
  return NextResponse.json({ data: { success: true } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { taskId: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(_request, { params });
  if (guardResult) return guardResult;

  const { removeWatcher } = await import("@/lib/watchers");
  await removeWatcher(params.taskId, userId);
  await logAudit({ actorUserId: userId, action: "watcher_removed", entityType: "watcher", entityId: params.taskId, after: { taskId: params.taskId, userId } as never });
  await emitTaskEvent("watcher.removed", params.taskId, { taskId: params.taskId, userId }, userId);
  return NextResponse.json({ data: { success: true } });
}