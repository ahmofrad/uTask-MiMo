import { describe, expect, it } from "vitest";
import {
  getTimelineDragDeltaDays,
  getTimelineItemGeometry,
  getTimelineItemWidth,
  getTimelinePosition,
  snapTimelineDate,
  shiftTimelineDateByDays,
} from "@/lib/gantt/timeline";

describe("getTimelineDragDeltaDays", () => {
  it("maps rightward pointer movement to later dates in LTR", () => {
    expect(getTimelineDragDeltaDays(100, 204, 52, "ltr")).toBe(2);
  });

  it("maps leftward pointer movement to later dates in RTL", () => {
    expect(getTimelineDragDeltaDays(204, 100, 52, "rtl")).toBe(2);
  });

  it("maps rightward pointer movement to earlier dates in RTL", () => {
    expect(getTimelineDragDeltaDays(100, 204, 52, "rtl")).toBe(-2);
  });

  it("snaps edge movement to whole calendar days", () => {
    expect(getTimelineDragDeltaDays(100, 130, 52, "ltr")).toBe(1);
    expect(getTimelineDragDeltaDays(130, 100, 52, "rtl")).toBe(1);
  });
});

describe("timeline item geometry", () => {
  const rangeStart = new Date("2026-08-19T00:00:00.000Z");

  it("keeps a same-day task inside exactly one calendar cell", () => {
    expect(getTimelineItemGeometry(
      new Date("2026-08-19T08:00:00.000Z"),
      new Date("2026-08-19T16:00:00.000Z"),
      rangeStart,
      52,
    )).toEqual({ startOffset: 0, width: 52 });
  });

  it("keeps date-only multi-day ranges through the end of the due date", () => {
    expect(getTimelineItemGeometry(
      new Date("2026-08-19T00:00:00.000Z"),
      new Date("2026-08-21T00:00:00.000Z"),
      rangeStart,
      52,
    )).toEqual({ startOffset: 0, width: 156 });
  });

  it("positions multi-day time ranges at their actual time of day", () => {
    expect(getTimelineItemGeometry(
      new Date("2026-08-19T12:00:00.000Z"),
      new Date("2026-08-21T12:00:00.000Z"),
      rangeStart,
      52,
    )).toEqual({ startOffset: 0.5, width: 104 });
  });

  it("snaps start and due values to their respective day boundaries", () => {
    const timestamp = new Date("2026-08-19T12:34:56.789Z");
    expect(snapTimelineDate(timestamp, "start").toISOString()).toBe("2026-08-19T00:00:00.000Z");
    expect(snapTimelineDate(timestamp, "end").toISOString()).toBe("2026-08-19T23:59:59.999Z");
  });

  it("shifts dates by fractional timeline days", () => {
    expect(shiftTimelineDateByDays(rangeStart, 0.5).toISOString()).toBe("2026-08-19T12:00:00.000Z");
    expect(shiftTimelineDateByDays(rangeStart, -0.5).toISOString()).toBe("2026-08-18T12:00:00.000Z");
  });
});

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

  it("uses the full inclusive calendar span for date-only task bars", () => {
    expect(getTimelineItemWidth(
      new Date("2026-08-19T00:00:00.000Z"),
      new Date("2026-08-21T00:00:00.000Z"),
      52,
    )).toBe(156);
  });

  it("keeps a one-day or incomplete task inside one calendar cell", () => {
    expect(getTimelineItemWidth(
      new Date("2026-08-19T09:00:00.000Z"),
      new Date("2026-08-19T17:00:00.000Z"),
      52,
    )).toBe(52);
    expect(getTimelineItemWidth(null, new Date("2026-08-19T17:00:00.000Z"), 52)).toBe(52);
  });
});
