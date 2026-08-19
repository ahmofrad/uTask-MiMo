import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKING_DAYS,
  isWorkingDay,
  nextWorkingDay,
  type WorkingDayConfig,
} from "@/lib/date/working-day";

// 2026-08-19 is a Wednesday, so Aug 22 = Saturday, Aug 23 = Sunday,
// Aug 24 = Monday, Aug 25 = Tuesday. Local calendar components keep these
// tests valid in any runtime zone.
const WEEKEND = { weekendDays: [6, 0], holidays: [] } satisfies WorkingDayConfig;

describe("isWorkingDay", () => {
  it("treats every day as working by default", () => {
    expect(isWorkingDay(new Date(2026, 7, 22, 12, 0), DEFAULT_WORKING_DAYS)).toBe(true);
    expect(isWorkingDay(new Date(2026, 7, 23, 12, 0), DEFAULT_WORKING_DAYS)).toBe(true);
  });

  it("treats configured weekend days as non-working", () => {
    expect(isWorkingDay(new Date(2026, 7, 21, 12, 0), WEEKEND)).toBe(true); // Fri
    expect(isWorkingDay(new Date(2026, 7, 22, 12, 0), WEEKEND)).toBe(false); // Sat
    expect(isWorkingDay(new Date(2026, 7, 23, 12, 0), WEEKEND)).toBe(false); // Sun
    expect(isWorkingDay(new Date(2026, 7, 24, 12, 0), WEEKEND)).toBe(true); // Mon
  });

  it("treats holiday dates as non-working even on a weekday", () => {
    const config: WorkingDayConfig = { weekendDays: [6, 0], holidays: [{ date: "2026-08-24", name: "Test holiday" }] };
    expect(isWorkingDay(new Date(2026, 7, 24, 12, 0), config)).toBe(false);
    expect(isWorkingDay(new Date(2026, 7, 25, 12, 0), config)).toBe(true);
  });

  it("anchors a UTC marker to its calendar day for the holiday check", () => {
    // 00:00Z Aug 24 is the canonical start marker for Monday the 24th.
    const config: WorkingDayConfig = { weekendDays: [], holidays: [{ date: "2026-08-24", name: "Holiday" }] };
    expect(isWorkingDay(new Date("2026-08-24T00:00:00.000Z"), config)).toBe(false);
    expect(isWorkingDay(new Date("2026-08-23T23:59:59.999Z"), config)).toBe(true);
  });
});

describe("nextWorkingDay", () => {
  it("returns the same day when it is already a working day", () => {
    const input = new Date(2026, 7, 24, 9, 30, 0, 0);
    const result = nextWorkingDay(input, WEEKEND);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(24);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(30);
  });

  it("moves a Saturday to the following Monday", () => {
    const result = nextWorkingDay(new Date(2026, 7, 22, 12, 0, 0, 0), WEEKEND);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(24);
    expect(result.getHours()).toBe(12);
  });

  it("keeps a canonical UTC start marker a start marker", () => {
    // Aug 22 2026 is a Saturday; the result must be Monday's start marker.
    expect(nextWorkingDay(new Date("2026-08-22T00:00:00.000Z"), WEEKEND).toISOString())
      .toBe("2026-08-24T00:00:00.000Z");
  });

  it("keeps a canonical UTC end marker an end marker", () => {
    expect(nextWorkingDay(new Date("2026-08-22T23:59:59.999Z"), WEEKEND).toISOString())
      .toBe("2026-08-24T23:59:59.999Z");
  });

  it("preserves the local time of day for genuine instants", () => {
    const result = nextWorkingDay(new Date(2026, 7, 22, 15, 30, 0, 0), WEEKEND);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(24);
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(30);
  });

  it("skips a holiday when looking for the next working day", () => {
    const config: WorkingDayConfig = {
      weekendDays: [6, 0],
      holidays: [{ date: "2026-08-24", name: "Monday off" }],
    };
    const result = nextWorkingDay(new Date(2026, 7, 22, 12, 0, 0, 0), config);
    expect(result.getDate()).toBe(25); // Tuesday
  });

  it("terminates when every weekday is non-working", () => {
    const config: WorkingDayConfig = { weekendDays: [0, 1, 2, 3, 4, 5, 6], holidays: [] };
    const result = nextWorkingDay(new Date(2026, 7, 24, 12, 0, 0, 0), config);
    expect(result.getDate()).toBe(31); // Aug 24 + 7 days
  });
});
