import { useMemo } from "react";
import { useLocale } from "next-intl";
import { toJalali, toGregorian, getMonthName, getDaysInMonth } from "@/lib/date/jalali";
import { formatNumber, type Locale } from "@/lib/date/format";
import {
  diffCalendarDays,
  normalizeStoredDayMarker,
  startOfCalendarDay,
  timelineDayStart,
  toDateOnly,
} from "@/lib/date/day-marker";
import { createWorkingDayCalendar, type WorkingDayConfig } from "@/lib/date/working-day-calendar";
import { getTimelinePosition, type TimelineDirection } from "@/lib/gantt/timeline";
import type { GanttRow } from "@/lib/gantt-types";

export type TimelineDay = {
  date: Date;
  offset: number;
  label: string;
  isMonthStart: boolean;
  isToday: boolean;
  isNonWorking: boolean;
  isDayOff: boolean;
  holidayName: string;
};

export type TimelineMonth = {
  key: string;
  label: string;
  startOffset: number;
  dayCount: number;
};

export type TimelineGeometry = {
  rangeStart: Date;
  totalDays: number;
  dayCount: number;
  days: TimelineDay[];
  months: TimelineMonth[];
  todayOffset: number | null;
  direction: TimelineDirection;
  dayOffset: (_date: Date | string | null) => number | null;
  dayPos: (_date: Date | string | null, _itemWidth?: number) => number;
  timelineXForOffset: (_offset: number, _itemWidth?: number) => number;
  dateFor: (_r: GanttRow) => { start: Date | null; end: Date | null };
  isDelayed: (_r: GanttRow) => boolean;
  delayedDays: (_r: GanttRow) => number;
  isInvalidLink: (_source: GanttRow, _target: GanttRow) => boolean;
};

export function useGanttTimeline(
  rows: GanttRow[],
  overrides: Record<string, { startDate: string | null; dueDate: string | null }>,
  workingDays: WorkingDayConfig | null,
  dayWidth: number,
): TimelineGeometry {
  const locale = useLocale() as Locale;
  const direction: TimelineDirection = locale === "fa-IR" ? "rtl" : "ltr";

  const { rangeStart, totalDays, dayCount, days, months, todayOffset } = useMemo(() => {
    const calendar = createWorkingDayCalendar(workingDays, locale);
    const today = startOfCalendarDay(new Date());
    const withDates = rows.flatMap((r) => {
      const s = r.startDate ?? r.summaryStart;
      const e = r.dueDate ?? r.summaryEnd;
      return [s, e].filter(Boolean).map((d) => new Date(d as string));
    });
    let start = withDates.length ? new Date(Math.min(...withDates.map((d) => d.getTime()))) : today;
    let end = withDates.length ? new Date(Math.max(...withDates.map((d) => d.getTime()))) : today;
    start = timelineDayStart(start);
    end = timelineDayStart(end);
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 90);
    const total = Math.max(diffCalendarDays(start, end), 14);
    const dc = total + 1;
    const genDays: TimelineDay[] = [];
    const genMonths: TimelineMonth[] = [];
    const cursor = new Date(start);
    let prevKey = "";
    for (let offset = 0; offset < dc; offset++) {
      const date = new Date(cursor);
      const jalali = toJalali(date);
      const monthKey = `${jalali.jy}-${jalali.jm}`;
      const isMonthStart = monthKey !== prevKey;
      genDays.push({
        date, offset,
        label: formatNumber(jalali.jd, locale, locale === "fa-IR"),
        isMonthStart,
        isToday: date.getTime() === today.getTime(),
        isNonWorking: calendar.isNonWorking(date),
        isDayOff: calendar.isDayOff(date),
        holidayName: calendar.holidayName(date) ?? "",
      });
      const cur = genMonths[genMonths.length - 1];
      if (isMonthStart || !cur) {
        genMonths.push({
          key: monthKey,
          label: `${getMonthName(jalali.jm, locale)} ${formatNumber(jalali.jy, locale, locale === "fa-IR", false)}`,
          startOffset: offset, dayCount: 1,
        });
      } else { cur.dayCount += 1; }
      prevKey = monthKey;
      cursor.setDate(cursor.getDate() + 1);
    }
    const todayOff = diffCalendarDays(start, today);
    return {
      rangeStart: start, totalDays: total, dayCount: dc,
      days: genDays, months: genMonths,
      todayOffset: todayOff >= 0 && todayOff < dc ? todayOff : null,
    };
  }, [locale, rows, workingDays]);

  const dayOffsetFn = (date: Date | string | null): number | null => {
    if (!date) return null;
    return Math.max(0, Math.min(totalDays, diffCalendarDays(rangeStart, timelineDayStart(new Date(date)))));
  };

  const dayPosFn = (date: Date | string | null, itemWidth = dayWidth): number => {
    const offset = dayOffsetFn(date);
    if (offset == null) return 0;
    return getTimelinePosition(offset, totalDays, dayWidth, direction, itemWidth);
  };

  const timelineXForOffsetFn = (offset: number, itemWidth = 0): number =>
    getTimelinePosition(offset, totalDays, dayWidth, direction, itemWidth);

  const todayStart = startOfCalendarDay(new Date());

  const dateFor = (r: GanttRow): { start: Date | null; end: Date | null } => {
    const o = overrides[r.id];
    const startStr = o?.startDate ?? r.startDate ?? r.summaryStart ?? null;
    const endStr = o?.dueDate ?? r.dueDate ?? r.summaryEnd ?? null;
    const s = startStr ?? endStr;
    const e = endStr ?? startStr;
    return {
      start: s ? normalizeStoredDayMarker(new Date(s)) : null,
      end: e ? normalizeStoredDayMarker(new Date(e)) : null,
    };
  };

  const isDelayed = (r: GanttRow): boolean => {
    if (r.status === "done") return false;
    const { end } = dateFor(r);
    if (!end) return false;
    return timelineDayStart(end).getTime() < todayStart.getTime();
  };

  const delayedDays = (r: GanttRow): number => {
    const { end } = dateFor(r);
    if (!end) return 0;
    return Math.max(0, diffCalendarDays(todayStart, timelineDayStart(end)));
  };

  const isInvalidLink = (source: GanttRow, target: GanttRow): boolean => {
    const sEnd = dateFor(source).end;
    const tStart = dateFor(target).start;
    if (!sEnd || !tStart) return false;
    return sEnd > tStart;
  };

  return {
    rangeStart, totalDays, dayCount, days, months, todayOffset, direction,
    dayOffset: dayOffsetFn,
    dayPos: dayPosFn,
    timelineXForOffset: timelineXForOffsetFn,
    dateFor, isDelayed, delayedDays, isInvalidLink,
  };
}

export function currentMonthRange(): { start: string; end: string } {
  const now = toJalali(new Date());
  return {
    start: toDateOnly(toGregorian(now.jy, now.jm, 1)),
    end: toDateOnly(toGregorian(now.jy, now.jm, getDaysInMonth(now.jy, now.jm))),
  };
}
