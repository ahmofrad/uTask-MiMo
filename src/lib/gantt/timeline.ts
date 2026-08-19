import {
  DAY_MS,
  isLocalEndOfDay,
  isLocalStartOfDay,
  isUtcDayMarker,
  isUtcEndMarker,
  normalizeStoredDayMarker,
  snapToDayBoundary,
  timelineDayStart,
} from "@/lib/date/day-marker";

export type TimelineDirection = "ltr" | "rtl";
export type TimelineDateBoundary = "start" | "end";

const MINUTES_PER_DAY = 24 * 60;

/**
 * Converts physical pointer movement into chronological day movement without
 * rounding, so a bar can follow the pointer continuously during a drag.
 *
 * In RTL, later dates are rendered farther left, so the physical delta is
 * inverted before it is applied to the task's dates.
 */
export function getTimelineDragRawDeltaDays(
  startX: number,
  currentX: number,
  dayWidth: number,
  direction: TimelineDirection,
): number {
  const rawDelta = (currentX - startX) / dayWidth;
  return direction === "rtl" ? -rawDelta : rawDelta;
}

/**
 * Rounded whole-day drag delta — the final snap applied on release. Kept for
 * callers that need the discrete day shift.
 */
export function getTimelineDragDeltaDays(
  startX: number,
  currentX: number,
  dayWidth: number,
  direction: TimelineDirection,
): number {
  return Math.round(getTimelineDragRawDeltaDays(startX, currentX, dayWidth, direction));
}

function calendarDayOffset(date: Date, rangeStart: Date): number {
  // Stored day markers anchor to their UTC calendar day so date-only values
  // land on the same cell in every timezone; genuine instants keep their
  // local calendar day. Both anchors are local midnights, so the difference
  // is always a whole number of days.
  return Math.round(
    (timelineDayStart(date).getTime() - timelineDayStart(rangeStart).getTime()) / DAY_MS,
  );
}

function timeOfDayFraction(date: Date): number {
  const milliseconds = (
    (((date.getHours() * 60) + date.getMinutes()) * 60 + date.getSeconds()) * 1000
  ) + date.getMilliseconds();
  return milliseconds / DAY_MS;
}

function timelineStartFraction(date: Date): number {
  // Stored day markers (00:00:00Z or 23:59:59.999Z) anchor the bar to its own
  // calendar day: a marker start sits at the day's start edge in every zone.
  // Genuine times keep their fractional placement.
  const normalized = normalizeStoredDayMarker(date);
  if (isUtcDayMarker(normalized)) return 0;
  return isLocalEndOfDay(normalized) ? 0 : timeOfDayFraction(normalized);
}

function timelineEndFraction(date: Date): number {
  // Stored day markers finish at the end edge of their calendar day, so a
  // single-day task covers exactly one cell in every zone.
  const normalized = normalizeStoredDayMarker(date);
  if (isUtcDayMarker(normalized)) return 1;
  const fraction = timeOfDayFraction(normalized);
  return isLocalStartOfDay(normalized) || isLocalEndOfDay(normalized) ? 1 : fraction;
}

/**
 * Returns the chronological fractional-day offset of a timestamp.
 * The offset includes the local time within its calendar day.
 */
export function getTimelineDateOffset(date: Date, rangeStart: Date): number {
  const normalized = normalizeStoredDayMarker(date);
  const fraction = isUtcDayMarker(normalized)
    ? isUtcEndMarker(normalized) ? 1 : 0
    : timeOfDayFraction(normalized);
  return calendarDayOffset(normalized, rangeStart) + fraction;
}

/**
 * Removes clock precision from a dragged timeline value. Delegates to the
 * shared day-marker convention so drag snaps can never drift from the
 * date-only storage format.
 */
export function snapTimelineDate(date: Date, boundary: TimelineDateBoundary): Date {
  return snapToDayBoundary(date, boundary);
}

/**
 * Returns the visual width of a task's timeline span.
 *
 * A same-day task occupies exactly one calendar cell. Multi-day tasks start
 * at the start edge of their first day and finish at the end edge of their
 * due day. Existing explicit times remain supported for report data.
 */
export function getTimelineItemWidth(
  start: Date | null,
  end: Date | null,
  dayWidth: number,
): number {
  if (!start || !end) return dayWidth;

  const normalizedStart = normalizeStoredDayMarker(start);
  const normalizedEnd = normalizeStoredDayMarker(end);
  const startDay = timelineDayStart(normalizedStart);
  const endDay = timelineDayStart(normalizedEnd);
  const calendarDayCount = Math.max(0, Math.round(
    (endDay.getTime() - startDay.getTime()) / DAY_MS,
  ));
  if (calendarDayCount === 0) return dayWidth;

  const spanDays = calendarDayCount + timelineEndFraction(normalizedEnd) - timelineStartFraction(normalizedStart);
  return Math.max(dayWidth, spanDays * dayWidth);
}

/**
 * Returns the chronological offset and width for a task bar.
 *
 * Same-day tasks are deliberately normalized to the calendar cell so their
 * visual bar never leaks into the previous or next day. Multi-day tasks use
 * timestamp precision, while date-only start/due values use day boundaries.
 */
export function getTimelineItemGeometry(
  start: Date | null,
  end: Date | null,
  rangeStart: Date,
  dayWidth: number,
): { startOffset: number; width: number } {
  const rawStart = start ?? end;
  const rawEnd = end ?? start;
  if (!rawStart || !rawEnd) return { startOffset: 0, width: dayWidth };
  const resolvedStart = normalizeStoredDayMarker(rawStart);
  const resolvedEnd = normalizeStoredDayMarker(rawEnd);

  const startDayOffset = calendarDayOffset(resolvedStart, rangeStart);
  if (calendarDayOffset(resolvedEnd, resolvedStart) === 0) {
    return { startOffset: startDayOffset, width: dayWidth };
  }

  return {
    startOffset: calendarDayOffset(resolvedStart, rangeStart) + timelineStartFraction(resolvedStart),
    width: getTimelineItemWidth(resolvedStart, resolvedEnd, dayWidth),
  };
}

/**
 * Shifts a timestamp by fractional local calendar days without losing the
 * user's local clock time across daylight-saving transitions.
 */
export function shiftTimelineDateByDays(date: Date, deltaDays: number): Date {
  const result = new Date(date);
  const wholeDays = Math.trunc(deltaDays);
  const fractionalDays = deltaDays - wholeDays;
  result.setDate(result.getDate() + wholeDays);
  result.setMinutes(result.getMinutes() + Math.round(fractionalDays * MINUTES_PER_DAY));
  return result;
}

/**
 * Returns the physical left coordinate for an item anchored to a date.
 *
 * The date offset is chronological: zero is the earliest date in the range.
 * RTL timelines mirror that coordinate system so the earliest date is on the
 * right and later dates progress toward the left.
 */
export function getTimelinePosition(
  dayOffset: number,
  lastDayOffset: number,
  dayWidth: number,
  direction: TimelineDirection,
  itemWidth = dayWidth,
): number {
  const totalWidth = Math.max(0, lastDayOffset + 1) * dayWidth;
  const offset = Math.max(0, Math.min(dayOffset, Math.max(0, lastDayOffset)));
  if (direction === "rtl") {
    return totalWidth - offset * dayWidth - itemWidth;
  }
  return offset * dayWidth;
}
