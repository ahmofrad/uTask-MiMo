import { z } from "zod";
import { prisma } from "@/lib/db";
import { isUtcEndMarker, isUtcStartMarker, normalizeStoredDayMarker, snapDayMarker, timelineDayStart, toDateOnly } from "@/lib/date/day-marker";
import {
  DEFAULT_WORKING_DAYS,
  type HolidayEntry,
  type WorkingDayConfig,
} from "@/lib/date/working-day-calendar";

// Re-export the shared types/default from the pure module so server-side
// imports of `@/lib/date/working-day` keep working unchanged.
export type { HolidayEntry, WorkingDayConfig };
export { DEFAULT_WORKING_DAYS };

/**
 * Working-day calendar: which days of the week are non-working (the weekend)
 * and which specific dates are holidays. Auto-scheduling consults this so a
 * task is never moved onto a non-working day.
 *
 * The config is stored in the `InstanceSetting` row with key `workingDays`
 * as `{ weekendDays: number[], holidays: { date, name }[] }`. `weekendDays`
 * uses JS `Date#getDay()` numbering (0 = Sunday … 6 = Saturday). An empty
 * `weekendDays` list means every weekday is a working day — which is also the
 * default when nothing is configured, so existing installs keep scheduling
 * across weekends until an admin configures the calendar.
 */

export const WORKING_DAYS_SETTING_KEY = "workingDays";

export const workingDayConfigSchema = z.object({
  weekendDays: z.array(z.number().int().min(0).max(6)).max(7),
  holidays: z.array(
    z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Holiday date must be yyyy-MM-dd")
        .refine((value) => {
          const [year, month, day] = value.split("-").map(Number);
          const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
          return (
            parsed.getUTCFullYear() === year
            && parsed.getUTCMonth() === (month ?? 1) - 1
            && parsed.getUTCDate() === day
          );
        }, "Not a real calendar date"),
      // Name is display-only; a date-only holiday is valid.
      name: z.string().trim().max(255).default(""),
      // Absent means day off (backward compatible); only provider imports
      // set it to false for non-off observances. Default keeps the stored
      // config explicit after any read/write cycle.
      dayOff: z.boolean().default(true),
    }),
  ).max(500),
}).strict();

/**
 * Loads the working-day calendar, falling back to all-days-working when
 * nothing is configured (or the stored value is corrupt).
 */
export async function getWorkingDayConfig(): Promise<WorkingDayConfig> {
  const row = await prisma.instanceSetting.findUnique({ where: { key: WORKING_DAYS_SETTING_KEY } });
  if (!row) return DEFAULT_WORKING_DAYS;
  const parsed = workingDayConfigSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_WORKING_DAYS;
}

const WEEKEND_LOOP_CAP = 8; // all 7 weekdays can be off; one extra iteration to terminate

/**
 * True when the day `date` falls on is a working day (not a weekend day and
 * not a holiday). Marker-aware: a stored day marker anchors to its UTC
 * calendar day, a genuine instant to its local calendar day — the same
 * convention as `timelineDayStart`.
 */
export function isWorkingDay(date: Date, config: WorkingDayConfig): boolean {
  const anchor = timelineDayStart(date);
  if (config.weekendDays.includes(anchor.getDay())) return false;
  const dayKey = toDateOnly(anchor);
  // Only actual day offs (not mere observances) block the working calendar.
  return !config.holidays.some((holiday) => holiday.date === dayKey && holiday.dayOff !== false);
}

/**
 * The earliest working day at or after `date`, preserving the value's shape:
 * a canonical UTC start marker stays a start marker, an end marker stays an
 * end marker, and a genuine instant keeps its local time of day. When every
 * weekday is non-working, the 8th day is returned (loop-terminating).
 */
export function nextWorkingDay(date: Date, config: WorkingDayConfig): Date {
  const normalized = normalizeStoredDayMarker(date);
  const isStartShape = isUtcStartMarker(normalized);
  const isEndShape = isUtcEndMarker(normalized);

  let candidate = new Date(timelineDayStart(normalized));
  let lastChecked = candidate;
  for (let i = 0; i < WEEKEND_LOOP_CAP; i++) {
    if (isWorkingDay(candidate, config)) return applyShape(candidate, normalized, isStartShape, isEndShape);
    lastChecked = candidate;
    candidate = new Date(candidate);
    candidate.setDate(candidate.getDate() + 1);
  }
  // Every weekday is non-working: return the last day we actually checked.
  return applyShape(lastChecked, normalized, isStartShape, isEndShape);
}

function applyShape(
  day: Date,
  source: Date,
  isStartShape: boolean,
  isEndShape: boolean,
): Date {
  if (isStartShape) return snapDayMarker(day, "start");
  if (isEndShape) return snapDayMarker(day, "end");
  const result = new Date(day);
  result.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return result;
}
