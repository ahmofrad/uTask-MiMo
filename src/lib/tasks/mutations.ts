import { prisma } from "@/lib/db";
import {
  computeSiblingOrderIndex,
  loadProjectParentMaps,
  ancestorDepth,
  subtreeMaxRelativeDepth,
  hasCycle,
  MAX_WBS_DEPTH,
  WbsGuardError,
} from "@/lib/tasks/wbs";
import { evaluateStatusChange, notifyUnblocked, DependencyBlockedError } from "@/lib/tasks/dependencies";
import { bumpScheduleVersion } from "@/lib/scheduling/cpm";
import { isTaskFinalizer, shouldRouteToApproval } from "@/lib/tasks/approval";
import {
  encodeRecurrenceRule,
  type RecurrenceRule,
} from "@/lib/tasks/recurrence";
// Approval mutations and recurrence spawning live in focused modules;
// re-export for backward compatibility.
export { approveTask, rejectTask } from "@/lib/tasks/approval-mutations";

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

/**
 * Fans out a group assignment to the group's current members. Later membership
 * changes do NOT retroactively update tasks — the fan-out is captured at
 * assignment time.
 */
async function resolveGroupAssigneeIds(groupId: string): Promise<string[]> {
  const memberships = await prisma.ldapGroupMembership.findMany({
    where: { ldapSyncGroupId: groupId },
    select: { userId: true },
  });
  return memberships.map((membership) => membership.userId);
}

function clampProgress(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function notifyNewAssignees(taskId: string, title: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const { ensureWatcher } = await import("@/lib/watchers");
  const { notify } = await import("@/lib/notifications");
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  for (const userId of userIds) {
    await ensureWatcher(taskId, userId);
    await notify({
      userId,
      type: "assigned",
      taskId,
      payload: { taskTitle: title },
    });

    try {
      const { notifyAssigned } = await import("@/lib/mail/send");
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        await notifyAssigned(user.email, title, `${baseUrl}/tasks/${taskId}`);
      }
    } catch (err) {
      const { logger } = await import("@/lib/logging");
      logger.warn({ err, taskId, userId }, "Failed to send assignment email");
    }
  }
}

/**
 * Auto-adds users as project members (default "contributor" role) when they
 * are assigned to a task in the project but aren't yet members.
 *
 * Idempotent: existing memberships (including disabled ones) are left alone;
 * only users who have never been a member of the project get a new row.
 */
async function ensureProjectMembers(projectId: string, assigneeIds: string[], adderId?: string) {
  if (assigneeIds.length === 0) return;
  const existingIds = new Set(
    (
      await prisma.projectMember.findMany({
        where: { projectId, userId: { in: assigneeIds } },
        select: { userId: true },
      })
    ).map((m) => m.userId),
  );
  const newIds = assigneeIds.filter((uid) => !existingIds.has(uid));
  if (newIds.length === 0) return;

  await prisma.projectMember.createMany({
    data: newIds.map((userId) => ({
      projectId,
      userId,
      projectRole: "contributor",
      addedBy: adderId ?? userId,
    })),
    skipDuplicates: true,
  });
}

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

export async function deleteTask(id: string) {
  const before = await prisma.task.findUnique({ where: { id } });

  await prisma.task.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return { before };
}

export async function reorderTasks(projectId: string, taskIds: string[]) {
  if (new Set(taskIds).size !== taskIds.length) {
    throw new WbsGuardError("TASK_SCOPE", "A task may only appear once in a reorder request");
  }
  const scopedTasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, projectId, deletedAt: null },
    select: { id: true },
  });
  if (scopedTasks.length !== taskIds.length) {
    throw new WbsGuardError("TASK_SCOPE", "All reordered tasks must belong to the active project");
  }

  // Use the caller's intended order from the input array, not DB order
  const updates = taskIds.map((id, i) =>
    prisma.task.update({
      where: { id, projectId },
      data: { orderIndex: (i + 1) * 1000 },
    }),
  );

  await prisma.$transaction(updates);
}

export type MoveTaskData = {
  newParentId?: string | null;
  position?: number;
};

export async function moveTask(id: string, data: MoveTaskData) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, projectId: true, parentTaskId: true, deletedAt: true },
  });
  if (!task || task.deletedAt) {
    throw new Error("Task not found");
  }

  const newParentId = data.newParentId === undefined ? task.parentTaskId : data.newParentId;
  const position = data.position ?? Number.MAX_SAFE_INTEGER;

  if (newParentId === id) {
    throw new WbsGuardError("SELF_PARENT", "A task cannot be its own parent");
  }

  if (newParentId != null) {
    const newParent = await prisma.task.findUnique({
      where: { id: newParentId },
      select: { id: true, projectId: true, deletedAt: true },
    });
    if (!newParent || newParent.deletedAt) {
      throw new WbsGuardError("PARENT_DELETED", "Target parent task is deleted or does not exist");
    }
    if (newParent.projectId !== task.projectId) {
      throw new WbsGuardError("CROSS_PROJECT", "Target parent belongs to another project");
    }
  }

  const maps = await loadProjectParentMaps(task.projectId);

  if (hasCycle(maps, id, newParentId)) {
    throw new WbsGuardError("CYCLE", "Moving here would create a cycle");
  }

  if (newParentId != null) {
    const newDepth = ancestorDepth(maps, newParentId) + 1;
    const subtreeDepth = subtreeMaxRelativeDepth(maps.childrenMap, id);
    if (newDepth + subtreeDepth > MAX_WBS_DEPTH) {
      throw new WbsGuardError("MAX_DEPTH", `WBS depth exceeds the maximum of ${MAX_WBS_DEPTH} levels`);
    }
  }

  const orderIndex = await computeSiblingOrderIndex(task.projectId, newParentId, position);

  const before = await prisma.task.findUnique({ where: { id } });

  const updated = await prisma.task.update({
    where: { id },
    data: { parentTaskId: newParentId, orderIndex },
  });

  return { before, task: updated };
}
