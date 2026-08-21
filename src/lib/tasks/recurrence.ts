import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { diffCalendarDays, shiftDayMarker, snapDayMarker, timelineDayStart } from "@/lib/date/day-marker";

/**
 * Recurrence rule for a task, stored JSON-encoded in `Task.recurrenceRule`.
 *
 * The simple (non-RRULE) form from the roadmap: a frequency, an interval, and
 * the anchor date that the series advances from. `count` is the number of
 * additional occurrences to spawn after the current one (decremented on each
 * spawn), and `endDate` caps the series.
 */
export const RECURRENCE_FREQS = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

export const recurrenceRuleSchema = z.object({
  freq: z.enum(RECURRENCE_FREQS),
  interval: z.number().int().min(1).max(366).default(1),
  anchor: z.enum(["startDate", "dueDate"]).default("dueDate"),
  count: z.number().int().min(0).optional(),
  endDate: z.string().optional(),
});

export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;

/** Decode a stored `recurrenceRule` string, or null when absent/invalid. */
export function decodeRecurrenceRule(encoded: string | null | undefined): RecurrenceRule | null {
  if (!encoded) return null;
  try {
    const parsed = recurrenceRuleSchema.safeParse(JSON.parse(encoded));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function encodeRecurrenceRule(rule: RecurrenceRule): string {
  return JSON.stringify(rule);
}

function shiftBoundary(date: Date, deltaDays: number, boundary: "start" | "end"): Date {
  return snapDayMarker(shiftDayMarker(date, deltaDays), boundary);
}

function addMonthsClamped(date: Date, months: number): Date {
  const normalized = timelineDayStart(date);
  const day = normalized.getDate();
  const target = new Date(normalized);
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

/**
 * The next occurrence date: the anchor advanced by exactly one period. The
 * result keeps the marker boundary of the anchor (start vs. due) so spawned
 * tasks keep the app's canonical day-marker convention.
 */
export function nextOccurrenceDate(rule: RecurrenceRule, anchor: Date): Date {
  const boundary = rule.anchor === "startDate" ? "start" : "end";
  switch (rule.freq) {
    case "DAILY":
      return shiftBoundary(anchor, rule.interval, boundary);
    case "WEEKLY":
      return shiftBoundary(anchor, rule.interval * 7, boundary);
    case "MONTHLY":
      return snapDayMarker(addMonthsClamped(anchor, rule.interval), boundary);
  }
}

/** Whether the series should spawn another occurrence (count/endDate caps). */
export function shouldSpawnNext(rule: RecurrenceRule, nextDate: Date): boolean {
  if (rule.count != null && rule.count <= 0) return false;
  if (rule.endDate) {
    const end = timelineDayStart(new Date(rule.endDate));
    if (timelineDayStart(nextDate).getTime() > end.getTime()) return false;
  }
  return true;
}

/**
 * Auto-advance sweep: for every open recurring task whose next occurrence
 * date is today or earlier, spawn the occurrence if a child for that date
 * slot does not already exist.  Called daily via a BullMQ repeatable job.
 */
export async function sweepRecurringTasks(taskDelegate: PrismaClient["task"]): Promise<number> {
  const now = new Date();
  const todayStart = timelineDayStart(now);

  const candidates = await taskDelegate.findMany({
    where: {
      recurrenceRule: { not: null },
      status: { notIn: ["done", "cancelled"] },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      description: true,
      priority: true,
      status: true,
      startDate: true,
      endDate: true,
      dueDate: true,
      recurrenceRule: true,
      recurrenceParentId: true,
      reporterId: true,
      createdById: true,
      assigneeGroupId: true,
      estimatedHours: true,
      isMilestone: true,
      requiresApproval: true,
      approverId: true,
      parentTaskId: true,
    },
  });

  let spawned = 0;

  for (const task of candidates) {
    const rule = decodeRecurrenceRule(task.recurrenceRule);
    if (!rule) continue;

    const anchor = rule.anchor === "startDate" ? task.startDate : task.dueDate;
    if (!anchor) continue;

    const next = nextOccurrenceDate(rule, anchor);
    if (!shouldSpawnNext(rule, next)) continue;

    // Only spawn when the next date is today or already in the past.
    if (timelineDayStart(next).getTime() > todayStart.getTime()) continue;

    // Guard: don't duplicate — a child may already have been spawned by the
    // complete-to-advance path.
    const deltaDays = diffCalendarDays(timelineDayStart(anchor), timelineDayStart(next));
    const shift = (d: Date, boundary: "start" | "end") =>
      snapDayMarker(shiftDayMarker(d, deltaDays), boundary);

    const where: { recurrenceParentId: string; deletedAt: null; dueDate?: Date; startDate?: Date } = {
      recurrenceParentId: task.recurrenceParentId ?? task.id,
      deletedAt: null,
    };
    if (task.dueDate) where.dueDate = shift(task.dueDate, "end");
    if (task.startDate) where.startDate = shift(task.startDate, "start");

    const existing = await taskDelegate.findFirst({
      where,
      select: { id: true },
    });
    if (existing) continue;

    const nextRule = childRule(rule);
    if (!nextRule) continue;

    const rootId = task.recurrenceParentId ?? task.id;
    await taskDelegate.create({
      data: {
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: "open",
        priority: task.priority,
        startDate: task.startDate ? shift(task.startDate, "start") : null,
        endDate: task.endDate ? shift(task.endDate, "end") : null,
        dueDate: task.dueDate ? shift(task.dueDate, "end") : null,
        recurrenceRule: encodeRecurrenceRule(nextRule),
        recurrenceParentId: rootId,
        reporterId: task.reporterId,
        createdById: task.createdById,
        assigneeGroupId: task.assigneeGroupId,
        estimatedHours: task.estimatedHours,
        isMilestone: task.isMilestone,
        requiresApproval: task.requiresApproval,
        approverId: task.approverId,
      },
    });

    spawned += 1;
  }

  return spawned;
}

/**
 * The rule the spawned occurrence carries (so the series continues), or null
 * when this spawn was the last one (count exhausted).
 */
export function childRule(rule: RecurrenceRule): RecurrenceRule | null {
  if (rule.count == null) return { ...rule };
  if (rule.count <= 0) return null;
  return { ...rule, count: rule.count - 1 };
}
