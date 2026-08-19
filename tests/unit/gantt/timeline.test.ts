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
    // Local-noon components so the fractional placement is 0.5 in any zone.
    expect(getTimelineItemGeometry(
      new Date(2026, 7, 19, 12, 0, 0, 0),
      new Date(2026, 7, 21, 12, 0, 0, 0),
      rangeStart,
      52,
    )).toEqual({ startOffset: 0.5, width: 104 });
  });

  it("anchors an end-of-day start to its own calendar day", () => {
    // A start stored at 23:59:59.999 is a day marker, not the next day.
    expect(getTimelineItemGeometry(
      new Date("2026-08-20T23:59:59.999Z"),
      new Date("2026-08-21T23:59:59.999Z"),
      rangeStart,
      52,
    )).toEqual({ startOffset: 1, width: 104 });
  });

  it("keeps a full multi-day span for an end-of-day start", () => {
    expect(getTimelineItemWidth(
      new Date("2026-08-19T23:59:59.999Z"),
      new Date("2026-08-21T23:59:59.999Z"),
      52,
    )).toBe(156);
  });

  it("snaps start and due values to their respective day boundaries", () => {
    // snapTimelineDate delegates to the local-clock snap, so assert the local
    // wall clock rather than a UTC ISO string.
    const timestamp = new Date(2026, 7, 19, 12, 34, 56, 789);
    const start = snapTimelineDate(timestamp, "start");
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(start.getDate()).toBe(19);
    const end = snapTimelineDate(timestamp, "end");
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
    expect(end.getDate()).toBe(19);
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
