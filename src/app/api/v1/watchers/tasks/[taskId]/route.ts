import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(
  _request: Request,
  { params }: { params: { taskId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { getWatchers } = await import("@/lib/watchers");
  const watchers = await getWatchers(params.taskId);
  return NextResponse.json({ data: watchers });
}

export async function POST(
  _request: Request,
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

  const { addWatcher } = await import("@/lib/watchers");
  await addWatcher(params.taskId, session.user.id);
  await logAudit({ actorUserId: session.user.id, action: "watcher_added", entityType: "watcher", entityId: params.taskId, after: { taskId: params.taskId, userId: session.user.id } as never });
  await emitTaskEvent("watcher.added", params.taskId, { taskId: params.taskId, userId: session.user.id }, session.user.id);
  return NextResponse.json({ data: { success: true } });
}

export async function DELETE(
  _request: Request,
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

  const { removeWatcher } = await import("@/lib/watchers");
  await removeWatcher(params.taskId, session.user.id);
  await logAudit({ actorUserId: session.user.id, action: "watcher_removed", entityType: "watcher", entityId: params.taskId, after: { taskId: params.taskId, userId: session.user.id } as never });
  await emitTaskEvent("watcher.removed", params.taskId, { taskId: params.taskId, userId: session.user.id }, session.user.id);
  return NextResponse.json({ data: { success: true } });
}
