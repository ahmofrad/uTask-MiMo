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

export type CreateTaskData = {
  title: string;
  description?: string | null;
  projectId: string;
  parentTaskId?: string | null;
  assigneeIds?: string[] | null;
  reporterId: string;
  createdById: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  progress?: number;
  tagIds?: string[];
  customFields?: Record<string, unknown>;
};

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

  const task = await prisma.task.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description ?? null,
      parentTaskId,
      assignees: {
        create: (data.assigneeIds ?? []).map((userId) => ({ userId })),
      },
      reporterId: data.reporterId,
      createdById: data.createdById,
      status: (data.status as never) ?? "open",
      priority: (data.priority as never) ?? "med",
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: data.estimatedHours ?? null,
      progress: clampProgress(data.progress),
      orderIndex,
    },
  });

  await notifyNewAssignees(task.id, task.title, data.assigneeIds ?? []);

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
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  spentHours?: number | null;
  parentTaskId?: string | null;
  progress?: number;
  deletedAt?: string | null;
  tagIds?: string[];
  customFields?: Record<string, unknown>;
};

export async function updateTask(id: string, data: UpdateTaskData, actorId?: string) {
  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours ?? null;
  if (data.spentHours !== undefined) updateData.spentHours = data.spentHours ?? null;
  if (data.parentTaskId !== undefined) updateData.parentTaskId = data.parentTaskId;
  if (data.deletedAt !== undefined) updateData.deletedAt = data.deletedAt === null ? null : new Date(data.deletedAt);

  if (data.progress !== undefined) updateData.progress = clampProgress(data.progress);

  if (data.status === "done") {
    updateData.completedAt = new Date();
    // Mark fully complete unless the caller set an explicit progress.
    if (data.progress === undefined) updateData.progress = 100;
  }

  const before = await prisma.task.findUnique({ where: { id } });

  if (data.status !== undefined && before && before.status !== data.status) {
    const evaluation = await evaluateStatusChange(id, data.status);
    if (!evaluation.allowed) {
      throw new DependencyBlockedError(evaluation.blockers);
    }
  }

  // Sync the multi-assignee list when provided.
  if (data.assigneeIds !== undefined) {
    const currentIds = (
      await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } })
    ).map((a) => a.userId);
    const nextIds = data.assigneeIds ?? [];
    const added = nextIds.filter((uid) => !currentIds.includes(uid));
    const removed = currentIds.filter((uid) => !nextIds.includes(uid));
    updateData.assignees = {
      deleteMany: { userId: { in: removed } },
      create: added.map((userId) => ({ userId })),
    };
    await notifyNewAssignees(id, before?.title ?? "", added);
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
  });

  if (before && (data.startDate !== undefined || data.dueDate !== undefined)) {
    await bumpScheduleVersion(before.projectId);
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

  return { before, task };
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
