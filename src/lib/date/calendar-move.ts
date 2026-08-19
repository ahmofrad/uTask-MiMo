import {
  DAY_MS,
  snapDayMarker,
  shiftDayMarker,
  timelineDayStart,
} from "@/lib/date/day-marker";

/**
 * Calendar-day helpers for the month view, aligned with the app's stored
 * date-only convention (UTC day markers: starts at `00:00:00.000Z`, dues at
 * `23:59:59.999Z`). Keeping this math here, marker-aware and timezone
 * independent, prevents the calendar from reproducing the mixed-convention
 * bugs the Gantt had (a canonical due marker placed on the next local day in
 * Asia/Tehran, drags writing local-midnight markers back to the DB).
 */

/**
 * The calendar-day anchor of a task's stored due date. A stored day marker
 * anchors to its UTC calendar day (so `2026-08-26T23:59:59.999Z` is Aug 26 in
 * every zone), a legacy zone-local marker to its intended day, and a genuine
 * instant to its local day.
 */
export function taskCalendarAnchor(dueDate: string): Date {
  return timelineDayStart(new Date(dueDate));
}

/**
 * Whole calendar days between a task's due marker-day and a target calendar
 * cell day. Both sides are anchored to local midnights, so the difference is
 * always a whole number of days.
 */
export function calendarDeltaDays(dueDate: string, targetDay: Date): number {
  const dueAnchor = taskCalendarAnchor(dueDate);
  const targetAnchor = timelineDayStart(targetDay);
  return Math.round((targetAnchor.getTime() - dueAnchor.getTime()) / DAY_MS);
}

/** Canonical start marker for a date-only start shifted by whole days. */
export function shiftCalendarStart(startDate: string, deltaDays: number): string {
  return snapDayMarker(shiftDayMarker(new Date(startDate), deltaDays), "start").toISOString();
}

/** Canonical due marker (`T23:59:59.999Z`) for a target calendar day. */
export function calendarDueMarker(targetDay: Date): string {
  return snapDayMarker(targetDay, "end").toISOString();
}
