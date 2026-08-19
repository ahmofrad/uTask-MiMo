import { describe, it, expect } from "vitest";
import { mergeHolidays } from "@/lib/date/holidays/merge";
import type { WorkingDayConfig } from "@/lib/date/working-day-calendar";

describe("mergeHolidays", () => {
  const base: WorkingDayConfig = {
    weekendDays: [6],
    holidays: [{ date: "2026-03-20", name: "Existing" }],
  };

  it("appends new dates and keeps existing entries unchanged", () => {
    const { config, imported, skipped } = mergeHolidays(base, [
      { date: "2026-08-24", name: "Arbaeen" },
    ]);
    expect(imported).toBe(1);
    expect(skipped).toBe(0);
    expect(config.holidays).toEqual([
      { date: "2026-03-20", name: "Existing" },
      { date: "2026-08-24", name: "Arbaeen" },
    ]);
  });

  it("skips duplicates and does not overwrite existing names", () => {
    const { config, imported, skipped } = mergeHolidays(base, [
      { date: "2026-03-20", name: "Overwrite attempt" },
      { date: "2026-03-20", name: "Another dup" },
    ]);
    expect(imported).toBe(0);
    expect(skipped).toBe(2);
    expect(config.holidays[0]?.name).toBe("Existing");
  });

  it("keeps the config sorted by date", () => {
    const { config } = mergeHolidays(base, [{ date: "2026-01-01", name: "Earlier" }]);
    expect(config.holidays.map((holiday) => holiday.date)).toEqual([
      "2026-01-01",
      "2026-03-20",
    ]);
  });
});
