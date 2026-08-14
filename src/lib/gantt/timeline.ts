export type TimelineDirection = "ltr" | "rtl";
export type TimelineDateBoundary = "start" | "end";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

/**
 * Converts physical pointer movement into chronological day movement.
 *
 * In RTL, later dates are rendered farther left, so the physical delta is
 * inverted before it is applied to the task's dates.
 */
export function getTimelineDragDeltaDays(
  startX: number,
  currentX: number,
  dayWidth: number,
  direction: TimelineDirection,
): number {
  const rawDelta = (currentX - startX) / dayWidth;
  const chronologicalDelta = direction === "rtl" ? -rawDelta : rawDelta;
  return Math.round(chronologicalDelta);
}

function startOfCalendarDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function calendarDayOffset(date: Date, rangeStart: Date): number {
  const dateDay = startOfCalendarDay(date);
  const rangeDay = startOfCalendarDay(rangeStart);
  return Math.round((dateDay.getTime() - rangeDay.getTime()) / MILLISECONDS_PER_DAY);
}

function timeOfDayFraction(date: Date): number {
  const milliseconds = (
    (((date.getHours() * 60) + date.getMinutes()) * 60 + date.getSeconds()) * 1000
  ) + date.getMilliseconds();
  return milliseconds / MILLISECONDS_PER_DAY;
}

function isStartOfDay(date: Date): boolean {
  return timeOfDayFraction(date) === 0;
}

function isEndOfDay(date: Date): boolean {
  return date.getHours() === 23
    && date.getMinutes() === 59
    && date.getSeconds() === 59
    && date.getMilliseconds() === 999;
}

function timelineStartFraction(date: Date): number {
  return timeOfDayFraction(date);
}

function timelineEndFraction(date: Date): number {
  const fraction = timeOfDayFraction(date);
  return isStartOfDay(date) || isEndOfDay(date) ? 1 : fraction;
}

/**
 * Returns the chronological fractional-day offset of a timestamp.
 * The offset includes the local time within its calendar day.
 */
export function getTimelineDateOffset(date: Date, rangeStart: Date): number {
  return calendarDayOffset(date, rangeStart) + timeOfDayFraction(date);
}

/**
 * Removes clock precision from a dragged timeline value.
 */
export function snapTimelineDate(date: Date, boundary: TimelineDateBoundary): Date {
  const result = new Date(date);
  if (boundary === "start") {
    result.setHours(0, 0, 0, 0);
  } else {
    result.setHours(23, 59, 59, 999);
  }
  return result;
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

  const startDay = startOfCalendarDay(start);
  const endDay = startOfCalendarDay(end);
  const calendarDayCount = Math.max(0, Math.round(
    (endDay.getTime() - startDay.getTime()) / MILLISECONDS_PER_DAY,
  ));
  if (calendarDayCount === 0) return dayWidth;

  const spanDays = calendarDayCount + timelineEndFraction(end) - timelineStartFraction(start);
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
  const resolvedStart = start ?? end;
  const resolvedEnd = end ?? start;
  if (!resolvedStart || !resolvedEnd) return { startOffset: 0, width: dayWidth };

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
