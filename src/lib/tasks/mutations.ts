import { prisma } from "@/lib/db";

export type CreateTaskData = {
  title: string;
  description?: string | null;
  projectId: string;
  parentTaskId?: string | null;
  assigneeId?: string | null;
  reporterId: string;
  createdById: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  estimatedHours?: number | null;
  customFields?: Record<string, unknown>;
};

export async function createTask(data: CreateTaskData) {
  const maxOrder = await prisma.task.aggregate({
    where: { projectId: data.projectId },
    _max: { orderIndex: true },
  });

  const task = await prisma.task.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description ?? null,
      parentTaskId: data.parentTaskId ?? null,
      assigneeId: data.assigneeId ?? null,
      reporterId: data.reporterId,
      createdById: data.createdById,
      status: (data.status as never) ?? "open",
      priority: (data.priority as never) ?? "med",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: data.estimatedHours ?? null,
      orderIndex: Number(maxOrder._max.orderIndex ?? 0) + 1000,
    },
  });

  if (data.customFields && typeof data.customFields === "object") {
    const { setCustomFieldValues } = await import("@/lib/custom-fields/values");
    await setCustomFieldValues(task.id, data.projectId, data.customFields);
  }

  return task;
}

export type UpdateTaskData = {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  spentHours?: number | null;
  parentTaskId?: string | null;
  deletedAt?: string | null;
  customFields?: Record<string, unknown>;
};

export async function updateTask(id: string, data: UpdateTaskData) {
  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
  if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours ?? null;
  if (data.spentHours !== undefined) updateData.spentHours = data.spentHours ?? null;
  if (data.parentTaskId !== undefined) updateData.parentTaskId = data.parentTaskId;
  if (data.deletedAt !== undefined) updateData.deletedAt = data.deletedAt === null ? null : new Date(data.deletedAt);

  if (data.status === "done") {
    updateData.completedAt = new Date();
  }

  const before = await prisma.task.findUnique({ where: { id } });

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
  });

  // Auto-watch on assignment + email notification
  if (data.assigneeId !== undefined && data.assigneeId !== null && data.assigneeId !== before?.assigneeId) {
    const { ensureWatcher } = await import("@/lib/watchers");
    await ensureWatcher(task.id, data.assigneeId);

    // In-app notification
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: data.assigneeId,
      type: "assigned",
      taskId: task.id,
      payload: { message: `You have been assigned to task "${task.title}"` },
    });

    // Email notification
    try {
      const { notifyAssigned } = await import("@/lib/mail/send");
      const assignee = await prisma.user.findUnique({
        where: { id: data.assigneeId },
        select: { email: true },
      });
      if (assignee?.email) {
        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
        await notifyAssigned(assignee.email, task.title, `${baseUrl}/tasks/${task.id}`);
      }
    } catch (err) {
      // Email failure should not block task update
      const { logger } = await import("@/lib/logging");
      logger.warn({ err, taskId: task.id }, "Failed to send assignment email");
    }
  }

  if (data.customFields && typeof data.customFields === "object") {
    const { setCustomFieldValues } = await import("@/lib/custom-fields/values");
    const fullTask = await prisma.task.findUnique({ where: { id }, select: { projectId: true } });
    if (fullTask) {
      await setCustomFieldValues(id, fullTask.projectId, data.customFields);
    }
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
