import { timelineDayStart, toDateOnly } from "@/lib/date/day-marker";

/**
 * The working-day calendar shape shared by display helpers and the scheduling
 * logic. Config types and the default live here (a pure module, no Prisma/DB)
 * so client components can import them without pulling the database client
 * into the browser bundle.
 */

export type HolidayEntry = { date: string; name: string };

export type WorkingDayConfig = {
  weekendDays: number[];
  holidays: HolidayEntry[];
};

export const DEFAULT_WORKING_DAYS: WorkingDayConfig = {
  weekendDays: [],
  holidays: [],
};

/**
 * Display helpers for calendar views: which days render as holidays and which
 * as non-working (weekend). A configured weekend overrides the locale default
 * (Friday for fa-IR, Sat+Sun otherwise); an empty/absent config falls back to
 * the locale default so untouched installs keep the familiar tint. Holidays
 * are always marked regardless of config. Marker-aware: a stored day marker
 * anchors to its UTC calendar day, a genuine instant to its local day.
 */
export type WorkingDayCalendar = {
  isHoliday: (_date: Date) => boolean;
  holidayName: (_date: Date) => string | null;
  isWeekend: (_date: Date) => boolean;
  isNonWorking: (_date: Date) => boolean;
};

export function createWorkingDayCalendar(
  config: WorkingDayConfig | null | undefined,
  locale: string,
): WorkingDayCalendar {
  const holidays = new Map((config?.holidays ?? []).map((h) => [h.date, h.name]));
  const weekendDays = config?.weekendDays?.length
    ? new Set(config.weekendDays)
    : new Set<number>(locale === "fa-IR" ? [5] : [0, 6]);
  return {
    isHoliday: (date) => holidays.has(toDateOnly(timelineDayStart(date))),
    holidayName: (date) => holidays.get(toDateOnly(timelineDayStart(date))) ?? null,
    isWeekend: (date) => weekendDays.has(timelineDayStart(date).getDay()),
    isNonWorking: (date) => {
      const anchor = timelineDayStart(date);
      return holidays.has(toDateOnly(anchor)) || weekendDays.has(anchor.getDay());
    },
  };
}
