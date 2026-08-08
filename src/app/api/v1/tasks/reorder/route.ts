import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { reorderTasks } from "@/lib/tasks";
import { WbsGuardError } from "@/lib/tasks/wbs";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { readJsonBody, reorderTasksSchema, validationError } from "@/lib/validation/api";

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = reorderTasksSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { projectId, taskIds } = parsed.data;

  if (!(await canProject(userId, "task:edit_any", projectId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  try {
    await reorderTasks(projectId, taskIds);
  } catch (error) {
    if (error instanceof WbsGuardError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 });
    }
    throw error;
  }

  await logAudit({ actorUserId: userId, action: "task_reordered", entityType: "task", entityId: projectId, after: { projectId, taskIds } as never });

  await emitTaskEvent("tasks.reordered", projectId, { projectId, taskIds }, userId);

  return NextResponse.json({ data: { success: true } });
}