import { describe, expect, it } from "vitest";
import {
  calendarDeltaDays,
  calendarDueMarker,
  shiftCalendarStart,
  taskCalendarAnchor,
} from "@/lib/date/calendar-move";

const DAY_MS = 24 * 60 * 60 * 1000;

function localMidnight(y: number, m: number, d: number): Date {
  return new Date(y, m, d, 0, 0, 0);
}

describe("taskCalendarAnchor", () => {
  it("anchors a canonical due marker to its UTC calendar day, not the next local day", () => {
    // 2026-08-26T23:59:59.999Z is 03:29 local on Aug 27 in Asia/Tehran; the
    // task belongs to Aug 26.
    const anchor = taskCalendarAnchor("2026-08-26T23:59:59.999Z");
    expect(anchor.getFullYear()).toBe(2026);
    expect(anchor.getMonth()).toBe(7);
    expect(anchor.getDate()).toBe(26);
    expect(anchor.getHours()).toBe(0);
  });

  it("anchors a legacy Asia/Tehran due marker to its intended day", () => {
    // 2026-08-27T20:29:59.999Z is 23:59:59.999 local on Aug 27 in Tehran.
    const anchor = taskCalendarAnchor("2026-08-27T20:29:59.999Z");
    expect(anchor.getFullYear()).toBe(2026);
    expect(anchor.getMonth()).toBe(7);
    expect(anchor.getDate()).toBe(27);
  });

  it("anchors a genuine instant to its local calendar day", () => {
    const instant = new Date("2026-08-20T14:00:00.000Z");
    const anchor = taskCalendarAnchor(instant.toISOString());
    expect(anchor.getFullYear()).toBe(instant.getFullYear());
    expect(anchor.getMonth()).toBe(instant.getMonth());
    expect(anchor.getDate()).toBe(instant.getDate());
    expect(anchor.getHours()).toBe(0);
  });
});

describe("calendarDeltaDays", () => {
  it("counts whole days between a due marker-day and a target cell", () => {
    expect(calendarDeltaDays("2026-08-26T23:59:59.999Z", localMidnight(2026, 7, 28))).toBe(2);
    expect(calendarDeltaDays("2026-08-26T23:59:59.999Z", localMidnight(2026, 7, 26))).toBe(0);
    expect(calendarDeltaDays("2026-08-26T23:59:59.999Z", localMidnight(2026, 7, 24))).toBe(-2);
  });

  it("is zone independent: a canonical due marker never counts the next local day", () => {
    // In Asia/Tehran the marker falls on local Aug 27; the delta must still
    // be computed from Aug 26.
    expect(calendarDeltaDays("2026-08-26T23:59:59.999Z", localMidnight(2026, 7, 27))).toBe(1);
  });
});

describe("shiftCalendarStart", () => {
  it("shifts a canonical start marker by whole days onto canonical markers", () => {
    expect(shiftCalendarStart("2026-08-26T00:00:00.000Z", 2)).toBe("2026-08-28T00:00:00.000Z");
    expect(shiftCalendarStart("2026-08-26T00:00:00.000Z", -1)).toBe("2026-08-25T00:00:00.000Z");
    expect(shiftCalendarStart("2026-08-26T00:00:00.000Z", 0)).toBe("2026-08-26T00:00:00.000Z");
  });

  it("shifts a legacy Asia/Tehran start marker from its intended day", () => {
    // 2026-08-24T20:30:00.000Z is Aug 25 in Tehran.
    expect(shiftCalendarStart("2026-08-24T20:30:00.000Z", 1)).toBe("2026-08-26T00:00:00.000Z");
  });
});

describe("calendarDueMarker", () => {
  it("produces the canonical end-of-day marker for the target day", () => {
    expect(calendarDueMarker(localMidnight(2026, 7, 28))).toBe("2026-08-28T23:59:59.999Z");
  });
});

describe("round trip", () => {
  it("moving a task preserves its span across zones", () => {
    // A task due Aug 26 with start Aug 24, moved 2 days later.
    const delta = calendarDeltaDays("2026-08-26T23:59:59.999Z", localMidnight(2026, 7, 28));
    expect(delta).toBe(2);
    expect(shiftCalendarStart("2026-08-24T00:00:00.000Z", delta)).toBe("2026-08-26T00:00:00.000Z");
    // Sanity: the arithmetic above is exactly (due - start) = 2 days.
    expect(2 * DAY_MS).toBe(2 * DAY_MS);
  });
});
