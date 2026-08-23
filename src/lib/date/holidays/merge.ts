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
  const holidays = [...config.holidays];
  let imported = 0;
  let skipped = 0;
  for (const entry of incoming) {
    const index = holidays.findIndex((holiday) => holiday.date === entry.date);
    if (index >= 0) {
      skipped++;
      // Re-downloading heals misclassified entries: the provider's day-off
      // verdict wins for a date we already carry (e.g. an observance imported
      // before the dayOff flag existed gets corrected to dayOff: false).
      if (entry.dayOff !== undefined) {
        const current = holidays[index];
        if (current) holidays[index] = { ...current, dayOff: entry.dayOff };
      }
      continue;
    }
    holidays.push(entry);
    imported++;
  }
  holidays.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { config: { ...config, holidays }, imported, skipped };
}
