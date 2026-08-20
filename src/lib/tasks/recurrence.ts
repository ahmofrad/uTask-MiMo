import { z } from "zod";
import { shiftDayMarker, snapDayMarker, timelineDayStart } from "@/lib/date/day-marker";

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
 * The rule the spawned occurrence carries (so the series continues), or null
 * when this spawn was the last one (count exhausted).
 */
export function childRule(rule: RecurrenceRule): RecurrenceRule | null {
  if (rule.count == null) return { ...rule };
  if (rule.count <= 0) return null;
  return { ...rule, count: rule.count - 1 };
}
