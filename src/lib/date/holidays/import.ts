import { getWorkingDayConfig, WORKING_DAYS_SETTING_KEY } from "@/lib/date/working-day";
import { setInstanceSetting } from "@/lib/settings/instance";
import { logAudit } from "@/lib/audit/log";
import { mergeHolidays } from "./merge";
import type { HolidayEntry } from "@/lib/date/working-day-calendar";

export type HolidayImportSource = "official" | "csv" | "download";

export type HolidayImportResult = {
  imported: number;
  skipped: number;
  total: number;
};

/**
 * Merges incoming holidays into the stored working-day calendar, persists the
 * result, and writes an audit entry. Used by every import path (bundled
 * official sets, CSV upload, egress download) so the behavior and audit trail
 * are identical.
 */
export async function applyHolidayImport(params: {
  actorUserId: string;
  source: HolidayImportSource;
  incoming: HolidayEntry[];
  detail?: Record<string, unknown>;
}): Promise<HolidayImportResult> {
  const before = await getWorkingDayConfig();
  const { config, imported, skipped } = mergeHolidays(before, params.incoming);
  await setInstanceSetting(WORKING_DAYS_SETTING_KEY, config, params.actorUserId);
  await logAudit({
    actorUserId: params.actorUserId,
    action: "holidays_imported",
    entityType: "settings",
    entityId: "working-days",
    before: { holidayCount: before.holidays.length },
    after: {
      holidayCount: config.holidays.length,
      source: params.source,
      imported,
      skipped,
      ...params.detail,
    },
  });
  return { imported, skipped, total: config.holidays.length };
}
