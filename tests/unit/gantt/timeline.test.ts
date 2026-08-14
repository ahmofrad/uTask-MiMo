import { describe, expect, it } from "vitest";
import { getTimelineItemWidth, getTimelinePosition } from "@/lib/gantt/timeline";

describe("getTimelinePosition", () => {
  it("keeps chronological dates left-to-right in English", () => {
    expect(getTimelinePosition(0, 30, 52, "ltr")).toBe(0);
    expect(getTimelinePosition(30, 30, 52, "ltr")).toBe(1560);
  });

  it("keeps chronological dates right-to-left in Persian", () => {
    expect(getTimelinePosition(0, 30, 52, "rtl")).toBe(1560);
    expect(getTimelinePosition(30, 30, 52, "rtl")).toBe(0);
  });

  it("accounts for the width of timeline items in RTL", () => {
    expect(getTimelinePosition(5, 30, 52, "rtl", 64)).toBe(1288);
  });

  it("uses the inclusive calendar span for task bars", () => {
    expect(getTimelineItemWidth(
      new Date("2026-08-19T09:00:00.000Z"),
      new Date("2026-08-21T17:00:00.000Z"),
      52,
      64,
    )).toBe(156);
  });

  it("keeps a one-day or incomplete task at the minimum bar width", () => {
    expect(getTimelineItemWidth(
      new Date("2026-08-19T09:00:00.000Z"),
      new Date("2026-08-19T17:00:00.000Z"),
      52,
      64,
    )).toBe(64);
    expect(getTimelineItemWidth(null, new Date("2026-08-19T17:00:00.000Z"), 52, 64)).toBe(64);
  });
});
