import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canEditTask } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { emitToProject } from "@/lib/realtime/server";
import { updateTask, DependencyBlockedError, type UpdateTaskData } from "@/lib/tasks";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

// Mirrors the updateable fields of `taskUpdateSchema` minus the paths that
// have their own bulk operations (custom fields, tags) and WBS moves, which
// are a different operation and intentionally excluded here.
const bulkPatchSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(100_000).nullable().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "med", "high", "urgent"]).optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  assigneeId: uuid.nullable().optional(),
  assigneeIds: z.array(uuid).max(100).optional(),
  assigneeGroupId: uuid.nullable().optional(),
  estimatedHours: z.number().finite().min(0).max(100_000).nullable().optional(),
  spentHours: z.number().finite().min(0).max(100_000).nullable().optional(),
  progress: z.number().finite().min(0).max(100).optional(),
  deletedAt: isoDate.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

const bulkTaskUpdateSchema = z.object({
  taskIds: z.array(uuid).min(1).max(200),
  patch: bulkPatchSchema,
}).strict();

type BulkPatch = z.infer<typeof bulkTaskUpdateSchema>["patch"];

function toUpdateData(patch: BulkPatch): UpdateTaskData {
  const data: UpdateTaskData = {};
  const {
    title, description, status: taskStatus, priority: taskPriority,
    startDate, endDate, dueDate, assigneeId, assigneeIds, assigneeGroupId,
    estimatedHours, spentHours, progress, deletedAt,
  } = patch;
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (taskStatus !== undefined) data.status = taskStatus;
  if (taskPriority !== undefined) data.priority = taskPriority;
  if (startDate !== undefined) data.startDate = startDate;
  if (endDate !== undefined) data.endDate = endDate;
  if (dueDate !== undefined) data.dueDate = dueDate;
  if (assigneeIds !== undefined) data.assigneeIds = assigneeIds;
  else if (assigneeId !== undefined) data.assigneeIds = assigneeId === null ? [] : [assigneeId];
  if (assigneeGroupId !== undefined) data.assigneeGroupId = assigneeGroupId;
  if (estimatedHours !== undefined) data.estimatedHours = estimatedHours;
  if (spentHours !== undefined) data.spentHours = spentHours;
  if (progress !== undefined) data.progress = progress;
  if (deletedAt !== undefined) data.deletedAt = deletedAt;
  return data;
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = bulkTaskUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const { taskIds, patch } = parsed.data;

  // Default-deny: every task must be editable by the actor, not just some.
  const permissions = await Promise.all(taskIds.map((id) => canEditTask(userId, id)));
  if (permissions.some((allowed) => !allowed)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  // Apply the same patch to every task. A dependency-blocked status change on
  // one task fails that task only — the rest still apply (matches the old
  // per-task PATCH behavior the UI used).
  const updateData = toUpdateData(patch);
  const updated: string[] = [];
  const failed: { taskId: string; code: string }[] = [];
  for (const id of taskIds) {
    try {
      await updateTask(id, updateData, userId);
      updated.push(id);
    } catch (err) {
      if (err instanceof DependencyBlockedError) {
        failed.push({ taskId: id, code: "DEPENDENCY_BLOCKED" });
      } else {
        throw err;
      }
    }
  }

  // One audited request: a single audit entry summarizing the bulk mutation
  // with the full affected-task list (the task ids double as the entity key,
  // mirroring how non-row entities use stable keys).
  await logAudit({
    actorUserId: userId,
    action: "task_updated",
    entityType: "task",
    entityId: taskIds.join(","),
    before: { taskIds },
    after: { taskIds, updated, failed, patch },
  });

  // Realtime + webhook events per changed task so open views stay in sync.
  const changed = await prisma.task.findMany({
    where: { id: { in: updated } },
    select: { id: true, title: true, projectId: true },
  });
  for (const task of changed) {
    await emitTaskEvent("task.updated", task.id, { id: task.id, title: task.title, projectId: task.projectId }, userId);
    emitToProject(task.projectId, "task.updated", { id: task.id, title: task.title, projectId: task.projectId, actorUserId: userId });
  }

  return NextResponse.json({
    data: {
      updated: updated.length,
      failed,
      taskIds: updated,
    },
  });
}
