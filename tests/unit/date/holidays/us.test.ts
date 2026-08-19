import { describe, it, expect } from "vitest";
import { usOfficialHolidays } from "@/lib/date/holidays/us";

function datesOf(year: number): Map<string, string> {
  return new Map(usOfficialHolidays(year).map((holiday) => [holiday.date, holiday.name]));
}

describe("US public holidays", () => {
  it("includes fixed-date holidays in 2024", () => {
    const byDate = datesOf(2024);
    expect(byDate.get("2024-01-01")).toBe("New Year's Day");
    expect(byDate.get("2024-06-19")).toBe("Juneteenth");
    expect(byDate.get("2024-07-04")).toBe("Independence Day");
    expect(byDate.get("2024-11-11")).toBe("Veterans Day");
    expect(byDate.get("2024-12-25")).toBe("Christmas Day");
  });

  it("computes the weekday-based holidays for 2024", () => {
    const byDate = datesOf(2024);
    expect(byDate.get("2024-01-15")).toBe("Martin Luther King Jr. Day"); // 3rd Monday
    expect(byDate.get("2024-02-19")).toBe("Washington's Birthday"); // 3rd Monday
    expect(byDate.get("2024-05-27")).toBe("Memorial Day"); // last Monday
    expect(byDate.get("2024-09-02")).toBe("Labor Day"); // 1st Monday
    expect(byDate.get("2024-10-14")).toBe("Columbus Day"); // 2nd Monday
    expect(byDate.get("2024-11-28")).toBe("Thanksgiving Day"); // 4th Thursday
  });

  it("is sorted and complete", () => {
    const holidays = usOfficialHolidays(2026);
    expect(holidays.length).toBe(11);
    const dates = holidays.map((holiday) => holiday.date);
    expect(dates).toEqual([...dates].sort());
  });
});
