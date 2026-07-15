import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function DELETE(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(request, { params });
  if (guardResult) return guardResult;

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "userId is required" } }, { status: 400 });
  }

  const { removeWatcher } = await import("@/lib/watchers");
  await removeWatcher(params.taskId, targetUserId);
  await logAudit({ actorUserId: userId, action: "watcher_removed", entityType: "watcher", entityId: params.taskId, after: { taskId: params.taskId, userId: targetUserId } as never });
  await emitTaskEvent("watcher.removed", params.taskId, { taskId: params.taskId, userId: targetUserId }, userId);
  return NextResponse.json({ data: { success: true } });
}