import { prisma } from "@/lib/db";
import { TaskNotPendingApprovalError } from "@/lib/tasks/approval";

/**
 * Spawn the next occurrence of a recurring task after its current occurrence
 * is completed. Deferred import to avoid circularity.
 */
export async function spawnNextRecurrence(task: { recurrenceRule: string | null; id: string }, actorId: string): Promise<void> {
  if (!task.recurrenceRule) return;
  const { decodeRecurrenceRule, childRule, nextOccurrenceDate, shouldSpawnNext } = await import("@/lib/tasks/recurrence");
  const rule = decodeRecurrenceRule(task.recurrenceRule);
  if (!rule) return;

  const full = await prisma.task.findUnique({ where: { id: task.id } });
  if (!full) return;
  const anchor = rule.anchor === "startDate" ? full.startDate : full.dueDate;
  if (!anchor) return;

  const next = nextOccurrenceDate(rule, anchor);
  if (!shouldSpawnNext(rule, next)) return;
  const nextRule = childRule(rule);
  if (!nextRule) return;

  const { diffCalendarDays, snapDayMarker, shiftDayMarker, timelineDayStart } = await import("@/lib/date/day-marker");
  const { encodeRecurrenceRule } = await import("@/lib/tasks/recurrence");
  const deltaDays = diffCalendarDays(timelineDayStart(anchor), timelineDayStart(next));
  const shift = (d: Date, boundary: "start" | "end") =>
    snapDayMarker(shiftDayMarker(d, deltaDays), boundary);

  const rootId = full.recurrenceParentId ?? full.id;
  const spawned = await prisma.task.create({
    data: {
      projectId: full.projectId,
      title: full.title,
      description: full.description,
      status: "open",
      priority: full.priority,
      startDate: full.startDate ? shift(full.startDate, "start") : null,
      endDate: full.endDate ? shift(full.endDate, "end") : null,
      dueDate: full.dueDate ? shift(full.dueDate, "end") : null,
      recurrenceRule: encodeRecurrenceRule(nextRule),
      recurrenceParentId: rootId,
      reporterId: full.reporterId,
      createdById: actorId || full.createdById,
      assigneeGroupId: full.assigneeGroupId,
      estimatedHours: full.estimatedHours,
      isMilestone: full.isMilestone,
      requiresApproval: full.requiresApproval,
      approverId: full.approverId,
    },
  });

  const { logAudit } = await import("@/lib/audit/log");
  await logAudit({
    actorUserId: actorId || null,
    action: "task_recurrence_spawned",
    entityType: "task",
    entityId: spawned.id,
    after: { parentTaskId: task.id, recurrenceRootId: rootId, recurrenceRule: encodeRecurrenceRule(nextRule) },
  });
}

export async function approveTask(id: string, actorId: string) {
  const before = await prisma.task.findUnique({ where: { id } });
  if (!before || before.deletedAt || before.status !== "pending_approval") {
    throw new TaskNotPendingApprovalError();
  }

  const task = await prisma.task.update({
    where: { id },
    data: { status: "done", completedAt: new Date(), progress: 100, approvalNote: null },
  });

  if (task.recurrenceRule) {
    await spawnNextRecurrence(task, actorId);
  }

  return { before, task };
}

export async function rejectTask(id: string, actorId: string, reason: string) {
  const before = await prisma.task.findUnique({ where: { id } });
  if (!before || before.deletedAt || before.status !== "pending_approval") {
    throw new TaskNotPendingApprovalError();
  }

  const task = await prisma.task.update({
    where: { id },
    data: { status: "in_progress", completedAt: null, approvalNote: reason },
  });

  return { before, task };
}