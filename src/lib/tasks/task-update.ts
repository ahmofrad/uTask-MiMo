import { prisma } from "@/lib/db";
import { evaluateStatusChange, notifyUnblocked, DependencyBlockedError } from "@/lib/tasks/dependencies";
import { bumpScheduleVersion } from "@/lib/scheduling/cpm";
import { isTaskFinalizer, shouldRouteToApproval } from "@/lib/tasks/approval";
import { encodeRecurrenceRule, type RecurrenceRule } from "@/lib/tasks/recurrence";
import {
  resolveGroupAssigneeIds,
  clampProgress,
  notifyNewAssignees,
  ensureProjectMembers,
} from "@/lib/tasks/task-common";

export type UpdateTaskData = {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeIds?: string[] | null;
  assigneeGroupId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  spentHours?: number | null;
  parentTaskId?: string | null;
  progress?: number;
  deletedAt?: string | null;
  requiresApproval?: boolean;
  approverId?: string | null;
  tagIds?: string[];
  customFields?: Record<string, unknown>;
  recurrence?: RecurrenceRule | null;
};

export async function updateTask(id: string, data: UpdateTaskData, actorId?: string) {
  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.requiresApproval !== undefined) updateData.requiresApproval = data.requiresApproval;
  if (data.approverId !== undefined) updateData.approverId = data.approverId;
  if (data.recurrence !== undefined)
    updateData.recurrenceRule = data.recurrence === null ? null : encodeRecurrenceRule(data.recurrence);
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours ?? null;
  if (data.spentHours !== undefined) updateData.spentHours = data.spentHours ?? null;
  if (data.parentTaskId !== undefined) updateData.parentTaskId = data.parentTaskId;
  if (data.deletedAt !== undefined) updateData.deletedAt = data.deletedAt === null ? null : new Date(data.deletedAt);
  if (data.assigneeGroupId !== undefined) updateData.assigneeGroupId = data.assigneeGroupId;

  if (data.progress !== undefined) updateData.progress = clampProgress(data.progress);

  const before = await prisma.task.findUnique({ where: { id } });

  // Approval gate: a DONE transition on a task that requires approval reroutes
  // to PENDING_APPROVAL unless the actor is a finalizer (the designated
  // approver or anyone with project task:edit_any).
  let effectiveStatus = data.status;
  if (
    data.status !== undefined &&
    before &&
    before.status !== data.status &&
    before.requiresApproval
  ) {
    const actorIsFinalizer =
      typeof actorId === "string" &&
      (await isTaskFinalizer(actorId, {
        projectId: before.projectId,
        approverId: before.approverId,
      }));
    if (shouldRouteToApproval({
      requiresApproval: true,
      requestedStatus: data.status,
      actorIsFinalizer,
    })) {
      effectiveStatus = "pending_approval";
      // The task was previously completed or rejected; reset those stamps so
      // the approval decision can set them again.
      updateData.completedAt = null;
      updateData.approvalNote = null;
    }
  }

  if (data.status !== undefined) updateData.status = effectiveStatus;

  if (effectiveStatus === "done") {
    updateData.completedAt = new Date();
    // Mark fully complete unless the caller set an explicit progress.
    if (data.progress === undefined) updateData.progress = 100;
  }

  if (data.status !== undefined && before && before.status !== data.status) {
    const evaluation = await evaluateStatusChange(id, data.status);
    if (!evaluation.allowed) {
      throw new DependencyBlockedError(evaluation.blockers);
    }
  }

  // Sync the multi-assignee list when provided. A group assignment fans out to
  // the group's current members (replacing the previous assignee rows — the
  // group is the assignee target); removing the group clears the fan-out rows.
  if (data.assigneeIds !== undefined || data.assigneeGroupId !== undefined) {
    const currentIds = (
      await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } })
    ).map((a) => a.userId);

    let nextIds: string[];
    if (data.assigneeGroupId) {
      nextIds = [...(await resolveGroupAssigneeIds(data.assigneeGroupId))];
      if (data.assigneeIds) {
        nextIds = Array.from(new Set([...nextIds, ...data.assigneeIds]));
      }
    } else if (data.assigneeGroupId === null) {
      // Group removed — clear the fan-out rows unless explicit assignees given.
      nextIds = data.assigneeIds ?? [];
    } else {
      nextIds = data.assigneeIds ?? currentIds;
    }

    const added = nextIds.filter((uid) => !currentIds.includes(uid));
    const removed = currentIds.filter((uid) => !nextIds.includes(uid));
    updateData.assignees = {
      deleteMany: { userId: { in: removed } },
      create: added.map((userId) => ({ userId })),
    };
    await notifyNewAssignees(id, before?.title ?? "", added);
    if (before && added.length > 0) {
      await ensureProjectMembers(before.projectId, added, actorId);
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
  });

  // Schedule guard: when a task's dates change, push its dependents forward
  // so the dependency constraints still hold. Runs for every date change (the
  // guard only ever moves tasks later, never earlier). The response carries
  // the pre-change dates of every moved task so clients can offer an undo.
  let autoScheduled: import("@/lib/scheduling/auto-schedule").AutoScheduledChange[] = [];
  if (before && (data.startDate !== undefined || data.dueDate !== undefined)) {
    await bumpScheduleVersion(before.projectId);
    const { autoScheduleDependents } = await import("@/lib/scheduling/auto-schedule");
    autoScheduled = await autoScheduleDependents(before.projectId, id, actorId);
  }

  if (data.tagIds) {
    const { assignTagsToTask } = await import("@/lib/tags");
    await assignTagsToTask(id, data.tagIds);
  }

  if (data.customFields && typeof data.customFields === "object") {
    const { setCustomFieldValues } = await import("@/lib/custom-fields/values");
    const fullTask = await prisma.task.findUnique({ where: { id }, select: { projectId: true } });
    if (fullTask) {
      await setCustomFieldValues(id, fullTask.projectId, data.customFields);
    }
  }

  if (data.status !== undefined && before && before.status !== data.status) {
    const assigneeIds = (
      await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } })
    ).map((a) => a.userId);
    const { notify } = await import("@/lib/notifications");
    for (const uid of assigneeIds) {
      if (uid !== actorId) {
        await notify({
          userId: uid,
          type: "status_changed",
          taskId: task.id,
          payload: { taskTitle: task.title },
        });
      }
    }
  }

  if (data.status === "done") {
    await notifyUnblocked(task.id, actorId ?? task.createdById);
  }

  // Recurring tasks: completing the current occurrence spawns the next one
  // (the approval gate may have rerouted a `done` request, so only spawn when
  // the task actually landed on `done`).
  if (task.status === "done" && before && before.status !== "done" && task.recurrenceRule) {
    const { spawnNextRecurrence } = await import("@/lib/tasks/approval-mutations");
    await spawnNextRecurrence(task, actorId ?? task.createdById);
  }

  return { before, task, autoScheduled };
}