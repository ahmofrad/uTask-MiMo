import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { emitToProject, emitToTask } from "@/lib/realtime/server";
import { computeSchedule } from "@/lib/scheduling/cpm";
import { getWorkingDayConfig, nextWorkingDay } from "@/lib/date/working-day";

/**
 * Schedule guard: after a task's dates change, push its transitive dependents
 * (FINISH_TO_START / START_TO_START / FINISH_TO_FINISH edges; RELATES_TO is
 * never a scheduling constraint) forward so the dependency constraints hold.
 *
 * The guard only ever moves a dependent's start LATER — it never moves tasks
 * earlier and never touches a dependent whose explicit dates already satisfy
 * every incoming constraint (the CPM engine treats explicit starts as a
 * floor, so `es` equals the current start whenever the dates are valid).
 * When a dependent is pushed, its due date shifts by the same amount so the
 * duration is preserved; a due-only task that lands before the constraint
 * gets its start set to the constraint instead.
 *
 * It operates on the same leaf-task graph as `computeSchedule`, so summary
 * rows are never rewritten. Every changed task is audited (`task_updated`)
 * and emits a `task.updated` event so clients and webhooks stay in sync.
 *
 * Returns the tasks whose dates actually changed, together with their
 * pre-change dates so callers can offer an undo.
 */
export type AutoScheduledChange = {
  id: string;
  title: string;
  startDate: Date | null;
  dueDate: Date | null;
};

export async function autoScheduleDependents(
  projectId: string,
  changedTaskId: string,
  actorId?: string | null,
): Promise<AutoScheduledChange[]> {
  // Fast path: nothing schedules off this task.
  const directEdge = await prisma.taskDependency.findFirst({
    where: { dependsOnId: changedTaskId, deletedAt: null, type: { not: "RELATES_TO" } },
    select: { id: true },
  });
  if (!directEdge) return [];

  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, parentTaskId: true, startDate: true, dueDate: true },
  });
  const parentIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!));
  const leafIds = new Set(tasks.filter((t) => !parentIds.has(t.id)).map((t) => t.id));
  if (!leafIds.has(changedTaskId)) return [];

  const edges = await prisma.taskDependency.findMany({
    where: {
      deletedAt: null,
      type: { not: "RELATES_TO" },
      taskId: { in: Array.from(leafIds) },
      dependsOnId: { in: Array.from(leafIds) },
    },
    select: { taskId: true, dependsOnId: true },
  });

  // Transitive closure of dependents (BFS over non-RELATES edges).
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.dependsOnId) ?? [];
    list.push(edge.taskId);
    outgoing.set(edge.dependsOnId, list);
  }
  const dependents: string[] = [];
  const seen = new Set<string>();
  const queue = [changedTaskId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of outgoing.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      dependents.push(next);
      queue.push(next);
    }
  }
  if (dependents.length === 0) return [];

  const schedule = await computeSchedule(projectId);
  const rowById = new Map(tasks.map((task) => [task.id, task]));
  const workingDayConfig = await getWorkingDayConfig();

  // Apply in earliest-start order so a chain settles in one pass (each `es`
  // already accounts for every incoming constraint, so the order only makes
  // the writes deterministic).
  dependents.sort((a, b) => (schedule.schedule[a]?.es ?? 0) - (schedule.schedule[b]?.es ?? 0));

  const updates: { id: string; before: { startDate: Date | null; dueDate: Date | null }; data: { startDate: Date; dueDate?: Date } }[] = [];

  for (const id of dependents) {
    const entry = schedule.schedule[id];
    const row = rowById.get(id);
    if (!entry || !row) continue;
    const earliestStart = new Date(entry.es);
    const currentStart = row.startDate;
    if (currentStart && currentStart.getTime() >= earliestStart.getTime()) continue; // already valid

    // Never land a pushed task on a non-working day: resolve the earliest
    // start (and the shifted due) onto the working-day calendar.
    const resolvedStart = nextWorkingDay(earliestStart, workingDayConfig);
    const data: { startDate: Date; dueDate?: Date } = { startDate: resolvedStart };
    if (currentStart && row.dueDate) {
      // Preserve the duration: shift the due date by the same amount, then
      // snap it to a working day too.
      const duration = row.dueDate.getTime() - currentStart.getTime();
      data.dueDate = nextWorkingDay(new Date(resolvedStart.getTime() + duration), workingDayConfig);
    } else if (row.dueDate && row.dueDate.getTime() < earliestStart.getTime()) {
      // Due-only task whose due would precede the constraint — clamp to it.
      data.dueDate = resolvedStart;
    }
    updates.push({
      id,
      before: { startDate: currentStart, dueDate: row.dueDate },
      data,
    });
  }

  if (updates.length === 0) return [];

  await prisma.$transaction(
    updates.map((update) =>
      prisma.task.update({ where: { id: update.id }, data: update.data }),
    ),
  );

  const changed: AutoScheduledChange[] = [];
  for (const update of updates) {
    const after = await prisma.task.findUnique({
      where: { id: update.id },
      select: { id: true, title: true, startDate: true, dueDate: true, projectId: true },
    });
    if (!after) continue;
    changed.push({
      id: after.id,
      title: after.title,
      startDate: update.before.startDate,
      dueDate: update.before.dueDate,
    });
    await logAudit({
      actorUserId: actorId ?? null,
      action: "task_updated",
      entityType: "task",
      entityId: after.id,
      before: update.before as never,
      after: { id: after.id, title: after.title, startDate: after.startDate, dueDate: after.dueDate } as never,
    });
    await emitTaskEvent("task.updated", after.id, { id: after.id, title: after.title, projectId: after.projectId }, actorId ?? "");
    emitToProject(after.projectId, "task.updated", { id: after.id, title: after.title, projectId: after.projectId, actorUserId: actorId ?? "" });
    emitToTask(after.id, "task.updated", { id: after.id, title: after.title, projectId: after.projectId });
  }

  return changed;
}
