import { describe, expect, it } from "vitest";
import { estimatedDaysToHours, estimatedHoursToDays } from "@/lib/date/estimated-time";

describe("estimated time conversion", () => {
  it("converts stored estimated hours to workdays", () => {
    expect(estimatedHoursToDays(8)).toBe(1);
    expect(estimatedHoursToDays(4)).toBe(0.5);
  });

  it("converts entered workdays to stored hours", () => {
    expect(estimatedDaysToHours(1)).toBe(8);
    expect(estimatedDaysToHours(0.5)).toBe(4);
  });

  it("preserves empty values", () => {
    expect(estimatedHoursToDays(null)).toBeNull();
    expect(estimatedDaysToHours(null)).toBeNull();
    expect(estimatedHoursToDays(undefined)).toBeUndefined();
    expect(estimatedDaysToHours(undefined)).toBeUndefined();
  });
});
