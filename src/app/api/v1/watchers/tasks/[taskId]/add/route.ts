import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function POST(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "userId is required" } }, { status: 400 });
  }

  const { addWatcher } = await import("@/lib/watchers");
  await addWatcher(params.taskId, userId);
  await logAudit({ actorUserId: session.user.id, action: "watcher_added", entityType: "watcher", entityId: params.taskId, after: { taskId: params.taskId, userId } as never });
  await emitTaskEvent("watcher.added", params.taskId, { taskId: params.taskId, userId }, session.user.id);
  return NextResponse.json({ data: { success: true } });
}