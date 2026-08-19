import type { HolidayEntry, WorkingDayConfig } from "@/lib/date/working-day-calendar";

/**
 * Merges incoming holidays into a working-day config. Existing entries keep
 * their place (and name) when a date already exists; incoming dates are
 * appended. Returns the merged config plus import counts so the UI can tell
 * the admin what actually changed.
 */
export function mergeHolidays(
  config: WorkingDayConfig,
  incoming: HolidayEntry[],
): { config: WorkingDayConfig; imported: number; skipped: number } {
  const existing = new Set(config.holidays.map((holiday) => holiday.date));
  const holidays = [...config.holidays];
  let imported = 0;
  let skipped = 0;
  for (const entry of incoming) {
    if (existing.has(entry.date)) {
      skipped++;
      continue;
    }
    existing.add(entry.date);
    holidays.push(entry);
    imported++;
  }
  holidays.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { config: { ...config, holidays }, imported, skipped };
}
