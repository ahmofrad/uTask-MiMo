import { describe, it, expect } from "vitest";
import { iranOfficialHolidays } from "@/lib/date/holidays/iran";

function datesOf(year: number): Map<string, string> {
  return new Map(iranOfficialHolidays(year).map((holiday) => [holiday.date, holiday.name]));
}

describe("Iranian official holidays", () => {
  it("includes the fixed solar holidays (Nowruz, 22 Bahman, ...) in 2024", () => {
    const byDate = datesOf(2024);
    expect(byDate.get("2024-03-20")).toContain("Nowruz");
    expect(byDate.get("2024-04-01")).toBe("Sizdah Bedar (Nature Day)");
    expect(byDate.get("2024-02-11")).toBe("Islamic Revolution Victory Day");
    expect(byDate.get("2024-03-19")).toBe("Nationalization of the Oil Industry");
  });

  it("includes the lunar holidays via the Umm al-Qura calendar in 2024", () => {
    const byDate = datesOf(2024);
    expect(byDate.get("2024-04-10")).toBe("Eid al-Fitr");
    expect(byDate.get("2024-04-11")).toBe("Eid al-Fitr Holiday");
    expect(byDate.get("2024-06-16")).toBe("Eid al-Adha");
    expect(byDate.get("2024-07-16")).toBe("Ashura");
    expect(byDate.get("2024-08-24")).toBe("Arbaeen"); // arithmetic; observed date can differ by a day
  });

  it("produces a realistic-sized, sorted, duplicate-free set", () => {
    for (const year of [2024, 2025, 2026]) {
      const holidays = iranOfficialHolidays(year);
      expect(holidays.length).toBeGreaterThanOrEqual(24);
      expect(holidays.length).toBeLessThanOrEqual(30);
      const dates = holidays.map((holiday) => holiday.date);
      expect(new Set(dates).size).toBe(dates.length);
      expect(dates).toEqual([...dates].sort());
    }
  });

  it("is zone-agnostic: the same dates under Tehran, UTC, and New York", () => {
    const set = (zone: string): string[] => {
      const original = process.env.TZ;
      process.env.TZ = zone;
      try {
        return iranOfficialHolidays(2026).map((holiday) => holiday.date);
      } finally {
        process.env.TZ = original;
      }
    };
    expect(set("Asia/Tehran")).toEqual(set("UTC"));
    expect(set("Asia/Tehran")).toEqual(set("America/New_York"));
  });
});
