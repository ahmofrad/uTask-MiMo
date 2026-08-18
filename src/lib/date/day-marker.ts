/**
 * Day-marker conventions for the app's stored date-only values.
 *
 * The app stores date-only values (task start/due dates, date custom fields)
 * as UTC day-boundary timestamps: starts at `00:00:00.000Z`, dues at
 * `23:59:59.xZ` (any millisecond — date shifts can leave values like
 * `23:59:59.998`). Those timestamps are day markers, not instants, so every
 * consumer must agree on how to detect and manipulate them. This module is
 * that single point of agreement — renderers, timeline geometry, and export
 * all import from here instead of re-implementing the checks.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the UTC components are exactly midnight — a stored date-only start. */
export function isUtcStartMarker(date: Date): boolean {
  return date.getUTCHours() === 0
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0;
}

/** True when the UTC components are 23:59:59 (any millisecond) — a stored date-only due. */
export function isUtcEndMarker(date: Date): boolean {
  return date.getUTCHours() === 23
    && date.getUTCMinutes() === 59
    && date.getUTCSeconds() === 59;
}

/** True for any stored date-only day marker (start or due). */
export function isUtcDayMarker(date: Date): boolean {
  return isUtcStartMarker(date) || isUtcEndMarker(date);
}

/** Local midnight of the given date — the calendar day it belongs to in the runtime's zone. */
export function startOfCalendarDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** True when the local wall clock is exactly midnight. */
export function isLocalStartOfDay(date: Date): boolean {
  return date.getHours() === 0
    && date.getMinutes() === 0
    && date.getSeconds() === 0
    && date.getMilliseconds() === 0;
}

/** True when the local wall clock is 23:59:59 (any millisecond). */
export function isLocalEndOfDay(date: Date): boolean {
  return date.getHours() === 23
    && date.getMinutes() === 59
    && date.getSeconds() === 59;
}

/** Whole local calendar days from `a` to `b`, aligning both to local midnight. */
export function diffCalendarDays(a: Date, b: Date): number {
  return Math.round((startOfCalendarDay(b).getTime() - startOfCalendarDay(a).getTime()) / DAY_MS);
}

/** True when both dates fall on the same local calendar day. */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfCalendarDay(a).getTime() === startOfCalendarDay(b).getTime();
}

/**
 * Snap a timestamp to the app's day-boundary convention: a start lands on
 * local midnight, a due on local 23:59:59.999.
 */
export function snapToDayBoundary(date: Date, boundary: "start" | "end"): Date {
  const result = new Date(date);
  if (boundary === "start") {
    result.setHours(0, 0, 0, 0);
  } else {
    result.setHours(23, 59, 59, 999);
  }
  return result;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local `yyyy-MM-dd` representation of a timestamp. */
export function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse a `yyyy-MM-dd` string into a local midnight timestamp. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}
