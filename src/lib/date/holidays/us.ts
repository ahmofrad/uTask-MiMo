import type { HolidayEntry } from "@/lib/date/working-day-calendar";

/**
 * Common United States public holidays, computed offline for any year:
 * fixed-date holidays plus the "nth weekday of month" ones (MLK Day,
 * Memorial Day, Labor Day, Thanksgiving, ...).
 */

const FIXED: ReadonlyArray<readonly [number, number, string]> = [
  [0, 1, "New Year's Day"],
  [5, 19, "Juneteenth"],
  [6, 4, "Independence Day"],
  [10, 11, "Veterans Day"],
  [11, 25, "Christmas Day"],
];

function nthWeekday(year: number, month: number, nth: number, weekday: number): Date {
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (nth - 1) * 7;
  return new Date(year, month, day);
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  const lastWeekday = last.getDay();
  const day = last.getDate() - ((lastWeekday - weekday + 7) % 7);
  return new Date(year, month, day);
}

function toDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The common US public holiday set for a Gregorian year. */
export function usOfficialHolidays(year: number): HolidayEntry[] {
  const entries: HolidayEntry[] = FIXED.map(([month, day, name]) => ({
    date: toDateOnly(new Date(year, month, day)),
    name,
  }));
  entries.push(
    { date: toDateOnly(nthWeekday(year, 0, 3, 1)), name: "Martin Luther King Jr. Day" },
    { date: toDateOnly(nthWeekday(year, 1, 3, 1)), name: "Washington's Birthday" },
    { date: toDateOnly(lastWeekday(year, 4, 1)), name: "Memorial Day" },
    { date: toDateOnly(nthWeekday(year, 8, 1, 1)), name: "Labor Day" },
    { date: toDateOnly(nthWeekday(year, 9, 2, 1)), name: "Columbus Day" },
    { date: toDateOnly(nthWeekday(year, 10, 4, 4)), name: "Thanksgiving Day" },
  );
  return entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
