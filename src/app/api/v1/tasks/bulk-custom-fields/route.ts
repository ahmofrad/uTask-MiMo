import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { prisma } from "@/lib/db";
import { bulkCustomFieldUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";
import { setCustomFieldValues } from "@/lib/custom-fields/values";
import { bumpScheduleVersion } from "@/lib/scheduling/cpm";

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = bulkCustomFieldUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { taskIds, projectId, customFields } = parsed.data;

  // Verify project access
  if (!(await canProject(userId, "task:edit_any", projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  // Verify all tasks belong to this project
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, projectId, deletedAt: null },
    select: { id: true, title: true },
  });

  if (tasks.length !== taskIds.length) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Some tasks were not found in this project" } },
      { status: 404 },
    );
  }

  // Apply custom field values to all tasks
  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      await setCustomFieldValues(task.id, projectId, customFields);
      return task.id;
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  // Audit log
  await logAudit({
    actorUserId: userId,
    action: "task_updated",
    entityType: "task",
    entityId: projectId,
    after: {
      bulkCustomFieldUpdate: true,
      taskIds,
      customFieldKeys: Object.keys(customFields),
      succeeded,
      failed,
    },
  });

  // Bump schedule version in case custom fields affect scheduling
  await bumpScheduleVersion(projectId);

  return NextResponse.json({
    data: { succeeded, failed, total: taskIds.length },
  });
}
