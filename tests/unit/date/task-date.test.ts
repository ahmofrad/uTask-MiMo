import { describe, expect, it } from "vitest";
import { normalizeTaskDate } from "@/lib/date/task-date";

describe("normalizeTaskDate", () => {
  it("converts a date-picker calendar value to an offset ISO datetime", () => {
    expect(normalizeTaskDate("2026-08-21")).toBe("2026-08-21T00:00:00.000Z");
  });

  it("preserves ISO datetimes and nullable values", () => {
    const iso = "2026-08-21T00:00:00.000Z";
    expect(normalizeTaskDate(iso)).toBe(iso);
    expect(normalizeTaskDate(null)).toBeNull();
    expect(normalizeTaskDate(undefined)).toBeUndefined();
  });
});
