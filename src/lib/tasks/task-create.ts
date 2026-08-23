import { prisma } from "@/lib/db";
import {
  computeSiblingOrderIndex,
  loadProjectParentMaps,
  ancestorDepth,
  MAX_WBS_DEPTH,
  WbsGuardError,
} from "@/lib/tasks/wbs";
import { encodeRecurrenceRule, type RecurrenceRule } from "@/lib/tasks/recurrence";
import {
  resolveGroupAssigneeIds,
  clampProgress,
  notifyNewAssignees,
  ensureProjectMembers,
} from "@/lib/tasks/task-common";

export type CreateTaskData = {
  title: string;
  description?: string | null;
  projectId: string;
  parentTaskId?: string | null;
  assigneeIds?: string[] | null;
  assigneeGroupId?: string | null;
  reporterId: string;
  createdById: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  progress?: number;
  requiresApproval?: boolean;
  approverId?: string | null;
  tagIds?: string[];
  customFields?: Record<string, unknown>;
  recurrence?: RecurrenceRule | null;
};

export async function createTask(data: CreateTaskData) {
  const parentTaskId: string | null = data.parentTaskId ?? null;
  let orderIndex: number;

  if (parentTaskId) {
    const parent = await prisma.task.findUnique({
      where: { id: parentTaskId },
      select: { id: true, projectId: true, deletedAt: true, parentTaskId: true },
    });
    if (!parent || parent.deletedAt) {
      throw new WbsGuardError("PARENT_NOT_FOUND", "Parent task not found");
    }
    if (parent.projectId !== data.projectId) {
      throw new WbsGuardError("CROSS_PROJECT", "Parent task belongs to another project");
    }
    const maps = await loadProjectParentMaps(data.projectId);
    if (ancestorDepth(maps, parentTaskId) + 1 > MAX_WBS_DEPTH) {
      throw new WbsGuardError("MAX_DEPTH", `WBS depth exceeds the maximum of ${MAX_WBS_DEPTH} levels`);
    }
    orderIndex = await computeSiblingOrderIndex(data.projectId, parentTaskId, Number.MAX_SAFE_INTEGER);
  } else {
    const maxOrder = await prisma.task.aggregate({
      where: { projectId: data.projectId },
      _max: { orderIndex: true },
    });
    orderIndex = Number(maxOrder._max.orderIndex ?? 0) + 1000;
  }

  // Group assignment fans out to the group's current members; explicit
  // assignees are merged in. Empty groups fan out to nobody (no-op).
  let assigneeIds = [...(data.assigneeIds ?? [])];
  let assigneeGroupId: string | null = null;
  if (data.assigneeGroupId) {
    const memberIds = await resolveGroupAssigneeIds(data.assigneeGroupId);
    assigneeIds = Array.from(new Set([...assigneeIds, ...memberIds]));
    assigneeGroupId = data.assigneeGroupId;
  }

  const task = await prisma.task.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description ?? null,
      parentTaskId,
      assignees: {
        create: assigneeIds.map((userId) => ({ userId })),
      },
      assigneeGroupId,
      reporterId: data.reporterId,
      createdById: data.createdById,
      status: (data.status as never) ?? "open",
      priority: (data.priority as never) ?? "med",
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: data.estimatedHours ?? null,
      progress: clampProgress(data.progress),
      requiresApproval: data.requiresApproval ?? false,
      approverId: data.approverId ?? null,
      recurrenceRule: data.recurrence ? encodeRecurrenceRule(data.recurrence) : null,
      orderIndex,
    },
  });

  await notifyNewAssignees(task.id, task.title, assigneeIds);
  await ensureProjectMembers(data.projectId, assigneeIds, data.createdById);

  if (data.customFields && typeof data.customFields === "object") {
    const { setCustomFieldValues } = await import("@/lib/custom-fields/values");
    await setCustomFieldValues(task.id, data.projectId, data.customFields);
  }

  if (data.tagIds) {
    const { assignTagsToTask } = await import("@/lib/tags");
    await assignTagsToTask(task.id, data.tagIds);
  }

  return task;
}