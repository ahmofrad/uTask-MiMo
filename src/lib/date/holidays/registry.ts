import { iranOfficialHolidays } from "./iran";
import { usOfficialHolidays } from "./us";
import type { HolidayEntry } from "@/lib/date/working-day-calendar";

/**
 * Bundled official holiday sets. Keys are stable slugs used by the admin UI
 * and import API. All providers compute offline — no network involved.
 */
export const HOLIDAY_REGIONS = ["ir", "us"] as const;

export type HolidayRegion = (typeof HOLIDAY_REGIONS)[number];

const REGION_LABELS: Record<HolidayRegion, { en: string; fa: string }> = {
  ir: { en: "Iran (official)", fa: "ایران (تعطیلات رسمی)" },
  us: { en: "United States (common)", fa: "ایالات متحده" },
};

export function holidayRegionLabel(region: HolidayRegion, locale: string): string {
  const label = REGION_LABELS[region];
  return locale === "fa-IR" ? label.fa : label.en;
}

export function officialHolidaysForRegion(region: HolidayRegion, year: number): HolidayEntry[] {
  switch (region) {
    case "ir":
      return iranOfficialHolidays(year);
    case "us":
      return usOfficialHolidays(year);
  }
}
