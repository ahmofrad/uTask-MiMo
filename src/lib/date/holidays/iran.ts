import { toGregorian, toJalali } from "@/lib/date/jalali";
import { hijriParts, hijriToGregorian, type HijriDate } from "./hijri";
import type { HolidayEntry } from "@/lib/date/working-day-calendar";

/**
 * The official Iranian holiday calendar, computed offline for any Gregorian
 * year:
 *
 * - Solar holidays are fixed Jalali dates (Nowruz, 13 Farvardin, 22 Bahman,
 *   ...), converted from Jalali to Gregorian.
 * - Lunar holidays (Eid al-Fitr, Eid al-Adha, Ashura, ...) move ~11 days
 *   earlier each Gregorian year; they are resolved via the built-in
 *   `islamic-umalqura` calendar (see `hijri.ts`).
 *
 * Names follow the widely used English transliteration. The set mirrors the
 * official ~28-day Iranian holiday list.
 */

// Solar holidays: [jalaliMonth, jalaliDay, name]
const SOLAR_HOLIDAYS: ReadonlyArray<readonly [number, number, string]> = [
  [1, 1, "Nowruz (New Year)"],
  [1, 2, "Nowruz Holiday"],
  [1, 3, "Nowruz Holiday"],
  [1, 4, "Nowruz Holiday"],
  [1, 12, "Islamic Republic Day"],
  [1, 13, "Sizdah Bedar (Nature Day)"],
  [3, 14, "Death of Imam Khomeini"],
  [3, 15, "15 Khordad Uprising"],
  [11, 22, "Islamic Revolution Victory Day"],
  [12, 29, "Nationalization of the Oil Industry"],
];

// Lunar holidays: [hijriMonth, hijriDay, name]
const LUNAR_HOLIDAYS: ReadonlyArray<readonly [number, number, string]> = [
  [12, 9, "Arafat Day"],
  [12, 10, "Eid al-Adha"],
  [12, 18, "Eid al-Ghadir"],
  [1, 1, "Islamic New Year"],
  [1, 9, "Tasua"],
  [1, 10, "Ashura"],
  [2, 20, "Arbaeen"],
  [2, 28, "Death of Prophet Muhammad"],
  [2, 30, "Martyrdom of Imam Reza"],
  [3, 17, "Birth of Prophet Muhammad"],
  [7, 13, "Birth of Imam Ali"],
  [7, 27, "Mab'ath"],
  [8, 3, "Birth of Imam Hussein"],
  [8, 15, "Birth of Imam Mahdi"],
  [9, 21, "Martyrdom of Imam Ali"],
  [10, 1, "Eid al-Fitr"],
  [10, 2, "Eid al-Fitr Holiday"],
  [10, 25, "Martyrdom of Imam Sadiq"],
];

function sameGregorianYear(a: Date, year: number): boolean {
  return a.getFullYear() === year;
}

/** Solar (Jalali) holidays whose Gregorian date falls in `year`. */
export function iranSolarHolidays(year: number): HolidayEntry[] {
  const years = new Set<number>();
  for (const instant of [Date.UTC(year, 0, 1), Date.UTC(year, 11, 31)]) {
    years.add(toJalali(new Date(instant)).jy);
  }
  const entries: HolidayEntry[] = [];
  for (const jy of years) {
    for (const [jm, jd, name] of SOLAR_HOLIDAYS) {
      const gregorian = toGregorian(jy, jm, jd);
      if (sameGregorianYear(gregorian, year)) {
        entries.push({ date: toDateOnlyLocal(gregorian), name });
      }
    }
  }
  return entries.sort(byDate);
}

/** Lunar (Islamic) holidays whose Gregorian date falls in `year`. */
export function iranLunarHolidays(year: number): HolidayEntry[] {
  const hijriYears = new Set<number>();
  for (const instant of [Date.UTC(year, 0, 1), Date.UTC(year, 11, 31)]) {
    hijriYears.add(hijriParts(new Date(instant)).hy);
  }
  const entries: HolidayEntry[] = [];
  for (const hy of hijriYears) {
    for (const [hm, hd, name] of LUNAR_HOLIDAYS) {
      const gregorian = hijriToGregorian(hy, hm, hd);
      // Skip dates that do not exist in this Hijri year (e.g. 30 Safar when
      // Safar has 29 days).
      if (gregorian == null) continue;
      if (sameGregorianYear(gregorian, year)) {
        entries.push({ date: toDateOnlyLocal(gregorian), name });
      }
    }
  }
  return entries.sort(byDate);
}

/** The full official Iranian holiday set for a Gregorian year. */
export function iranOfficialHolidays(year: number): HolidayEntry[] {
  const entries = [...iranSolarHolidays(year), ...iranLunarHolidays(year)];
  // When a solar and a lunar holiday collide on the same date, Iran observes
  // the lunar religious day and the solar anniversary is dropped (e.g. 12
  // Farvardin 1403 fell on 21 Ramadan 1445). Later entries (lunar) win.
  const deduped = new Map<string, HolidayEntry>();
  for (const entry of entries) deduped.set(entry.date, entry);
  return [...deduped.values()].sort(byDate);
}

function byDate(a: HolidayEntry, b: HolidayEntry): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function toDateOnlyLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type { HijriDate };
