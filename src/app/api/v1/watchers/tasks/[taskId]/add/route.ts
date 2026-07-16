import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "userId is required" } }, { status: 400 });
  }

  const { addWatcher } = await import("@/lib/watchers");
  await addWatcher(resolvedParams.taskId, targetUserId);
  await logAudit({ actorUserId: userId, action: "watcher_added", entityType: "watcher", entityId: resolvedParams.taskId, after: { taskId: resolvedParams.taskId, userId: targetUserId } as never });
  await emitTaskEvent("watcher.added", resolvedParams.taskId, { taskId: resolvedParams.taskId, userId: targetUserId }, userId);
  return NextResponse.json({ data: { success: true } });
}