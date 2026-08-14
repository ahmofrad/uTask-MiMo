export type TimelineDirection = "ltr" | "rtl";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfCalendarDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Returns the inclusive width of a task's calendar-day span.
 *
 * A one-day task keeps the minimum width so it remains easy to see, while
 * multi-day tasks occupy one timeline cell per calendar day.
 */
export function getTimelineItemWidth(
  start: Date | null,
  end: Date | null,
  dayWidth: number,
  minimumWidth: number,
): number {
  if (!start || !end) return minimumWidth;

  const startDay = startOfCalendarDay(start);
  const endDay = startOfCalendarDay(end);
  const dayCount = Math.max(
    1,
    Math.round((endDay.getTime() - startDay.getTime()) / MILLISECONDS_PER_DAY) + 1,
  );
  return Math.max(minimumWidth, dayCount * dayWidth);
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
