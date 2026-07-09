import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { reorderTasks } from "@/lib/tasks";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const { projectId, taskIds } = body as { projectId?: string; taskIds?: string[] };

  if (!projectId || !taskIds || !Array.isArray(taskIds) || taskIds.length < 2) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId and taskIds array (min 2) required" } },
      { status: 400 },
    );
  }

  await reorderTasks(projectId, taskIds);

  await logAudit({ actorUserId: session.user.id, action: "task_reordered", entityType: "task", entityId: projectId, after: { projectId, taskIds } as never });

  await emitTaskEvent("tasks.reordered", projectId, { projectId, taskIds }, session.user.id);

  return NextResponse.json({ data: { success: true } });
}
