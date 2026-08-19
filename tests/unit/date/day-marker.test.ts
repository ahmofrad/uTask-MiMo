import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  diffCalendarDays,
  isLocalEndOfDay,
  isLocalStartOfDay,
  isSameCalendarDay,
  isSameTimelineDay,
  isUtcDayMarker,
  isUtcEndMarker,
  isUtcStartMarker,
  normalizeStoredDayMarker,
  parseDateOnly,
  shiftDayMarker,
  snapDayMarker,
  snapToDayBoundary,
  startOfCalendarDay,
  timelineDayStart,
  toDateOnly,
} from "@/lib/date/day-marker";

describe("UTC day-boundary markers", () => {
  it("recognizes a stored start at 00:00:00.000Z", () => {
    expect(isUtcStartMarker(new Date("2026-08-21T00:00:00.000Z"))).toBe(true);
    expect(isUtcEndMarker(new Date("2026-08-21T00:00:00.000Z"))).toBe(false);
    expect(isUtcDayMarker(new Date("2026-08-21T00:00:00.000Z"))).toBe(true);
  });

  it("recognizes a stored due at 23:59:59 with any millisecond", () => {
    expect(isUtcEndMarker(new Date("2026-08-23T23:59:59.999Z"))).toBe(true);
    // Date shifts can leave markers like 23:59:59.998.
    expect(isUtcEndMarker(new Date("2026-08-23T23:59:59.998Z"))).toBe(true);
    expect(isUtcDayMarker(new Date("2026-08-23T23:59:59.000Z"))).toBe(true);
  });

  it("rejects genuine instants", () => {
    expect(isUtcDayMarker(new Date("2026-08-21T02:00:00.000Z"))).toBe(false);
    expect(isUtcDayMarker(new Date("2026-08-21T23:59:00.000Z"))).toBe(false);
  });
});

// The helpers under test are local-wall-clock semantics: they operate on the
// runtime zone's calendar day, so inputs are built from local calendar
// components and expectations assert local properties. This keeps the tests
// green in any TZ (UTC, Asia/Tehran, ...) — never hardcode UTC ISO strings
// against a local-semantics helper.
describe("local wall-clock checks", () => {
  it("detects local midnight", () => {
    expect(isLocalStartOfDay(new Date(2026, 7, 21, 0, 0, 0, 0))).toBe(true);
    expect(isLocalStartOfDay(new Date(2026, 7, 21, 0, 0, 0, 1))).toBe(false);
  });

  it("detects local 23:59:59 regardless of milliseconds", () => {
    expect(isLocalEndOfDay(new Date(2026, 7, 21, 23, 59, 59, 0))).toBe(true);
    expect(isLocalEndOfDay(new Date(2026, 7, 21, 23, 59, 59, 999))).toBe(true);
    expect(isLocalEndOfDay(new Date(2026, 7, 21, 23, 59, 58, 999))).toBe(false);
  });
});

describe("calendar day helpers", () => {
  it("zeroes the local clock", () => {
    const input = new Date(2026, 7, 21, 14, 30, 0, 0);
    const result = startOfCalendarDay(input);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    // Same local calendar day as the input, never later than it.
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(21);
    expect(result.getTime()).toBeLessThanOrEqual(input.getTime());
  });

  it("counts whole calendar days between dates", () => {
    expect(diffCalendarDays(
      new Date(2026, 7, 19, 0, 0, 0, 0),
      new Date(2026, 7, 21, 0, 0, 0, 0),
    )).toBe(2);
    expect(diffCalendarDays(
      new Date(2026, 7, 21, 23, 0, 0, 0),
      new Date(2026, 7, 19, 1, 0, 0, 0),
    )).toBe(-2);
  });

  it("compares calendar days, ignoring time of day", () => {
    expect(isSameCalendarDay(
      new Date(2026, 7, 21, 8, 0, 0, 0),
      new Date(2026, 7, 21, 23, 59, 0, 0),
    )).toBe(true);
    expect(isSameCalendarDay(
      new Date(2026, 7, 21, 23, 59, 0, 0),
      new Date(2026, 7, 22, 0, 1, 0, 0),
    )).toBe(false);
  });
});

describe("snapToDayBoundary", () => {
  it("snaps a start to local midnight and a due to local 23:59:59.999", () => {
    const timestamp = new Date(2026, 7, 19, 12, 34, 56, 789);
    const start = snapToDayBoundary(timestamp, "start");
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(start.getDate()).toBe(19);
    const end = snapToDayBoundary(timestamp, "end");
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
    expect(end.getDate()).toBe(19);
  });
});

describe("date-only round trips", () => {
  it("formats a date as yyyy-MM-dd", () => {
    // Local noon components: toDateOnly formats the local calendar day, so
    // hardcoding a UTC ISO string would flip the day in negative-offset zones.
    expect(toDateOnly(new Date(2026, 7, 5, 12, 0, 0, 0))).toBe("2026-08-05");
    expect(toDateOnly(new Date(2026, 10, 30, 12, 0, 0, 0))).toBe("2026-11-30");
  });

  it("parses yyyy-MM-dd back into a local midnight timestamp", () => {
    const parsed = parseDateOnly("2026-08-05");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7); // August
    expect(parsed.getDate()).toBe(5);
  });

  it("round-trips through toDateOnly and parseDateOnly", () => {
    const original = new Date(2026, 7, 5, 12, 0, 0, 0);
    expect(toDateOnly(parseDateOnly(toDateOnly(original)))).toBe("2026-08-05");
  });
});

describe("normalizeStoredDayMarker (legacy Asia/Tehran markers)", () => {
  it("passes canonical UTC markers through unchanged", () => {
    const start = new Date("2026-08-25T00:00:00.000Z");
    const due = new Date("2026-08-28T23:59:59.999Z");
    expect(normalizeStoredDayMarker(start).toISOString()).toBe("2026-08-25T00:00:00.000Z");
    expect(normalizeStoredDayMarker(due).toISOString()).toBe("2026-08-28T23:59:59.999Z");
  });

  it("passes genuine instants through unchanged", () => {
    const instant = new Date("2026-08-30T07:13:18.490Z");
    expect(normalizeStoredDayMarker(instant).toISOString()).toBe("2026-08-30T07:13:18.490Z");
  });

  it("converts a legacy Tehran local-midnight start to the canonical UTC marker", () => {
    // 2026-08-24T20:30:00Z is 00:00 on Aug 25 in Asia/Tehran.
    const legacy = new Date("2026-08-24T20:30:00.000Z");
    expect(normalizeStoredDayMarker(legacy).toISOString()).toBe("2026-08-25T00:00:00.000Z");
    expect(isUtcStartMarker(normalizeStoredDayMarker(legacy))).toBe(true);
  });

  it("converts a legacy Tehran local-end marker to the canonical UTC due", () => {
    // Tehran is UTC+03:30, so local 23:59:59.999 on Aug 27 is
    // 2026-08-27T20:29:59.999Z — the same UTC date. Shifting +03:30 yields
    // the canonical end marker for that day.
    const legacy = new Date("2026-08-27T20:29:59.999Z");
    expect(normalizeStoredDayMarker(legacy).toISOString()).toBe("2026-08-27T23:59:59.999Z");
    expect(isUtcEndMarker(normalizeStoredDayMarker(legacy))).toBe(true);
  });

  it("anchors a legacy marker to the intended calendar day via timelineDayStart", () => {
    const legacy = new Date("2026-08-24T20:30:00.000Z");
    const anchor = timelineDayStart(legacy);
    expect(anchor.getFullYear()).toBe(2026);
    expect(anchor.getMonth()).toBe(7);
    expect(anchor.getDate()).toBe(25);
  });

  it("shifts a legacy marker from its intended calendar day", () => {
    const legacy = new Date("2026-08-24T20:30:00.000Z");
    const shifted = shiftDayMarker(legacy, 1);
    expect(shifted.getFullYear()).toBe(2026);
    expect(shifted.getMonth()).toBe(7);
    expect(shifted.getDate()).toBe(26);
  });
});

describe("timeline day helpers (marker-aware)", () => {
  it("anchors a stored marker to its UTC calendar day", () => {
    // A due marker that falls on the next local day must still anchor to the
    // calendar day its UTC components say.
    const due = new Date("2026-08-19T23:59:59.999Z");
    const anchor = timelineDayStart(due);
    expect(anchor.getFullYear()).toBe(2026);
    expect(anchor.getMonth()).toBe(7);
    expect(anchor.getDate()).toBe(19);
    expect(anchor.getHours()).toBe(0);
  });

  it("anchors a genuine instant to its local calendar day", () => {
    const instant = new Date("2026-08-19T15:30:00.000Z");
    const anchor = timelineDayStart(instant);
    expect(anchor.getDate()).toBe(instant.getDate());
    expect(anchor.getHours()).toBe(0);
  });

  it("treats a single-day marker pair as the same timeline day", () => {
    const start = new Date("2026-08-19T00:00:00.000Z");
    const due = new Date("2026-08-19T23:59:59.999Z");
    expect(isSameTimelineDay(start, due)).toBe(true);
    expect(isSameTimelineDay(start, new Date("2026-08-20T00:00:00.000Z"))).toBe(false);
  });

  it("shifts a marker by whole and fractional days", () => {
    const start = new Date("2026-08-19T00:00:00.000Z");
    const shifted = shiftDayMarker(start, 2);
    expect(shifted.getFullYear()).toBe(2026);
    expect(shifted.getMonth()).toBe(7);
    expect(shifted.getDate()).toBe(21);
    expect(shifted.getHours()).toBe(0);
  });

  it("snaps a shifted marker back to the stored UTC convention", () => {
    const anchor = new Date(2026, 7, 20); // local Aug 20 midnight
    expect(snapDayMarker(anchor, "start").toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(snapDayMarker(anchor, "end").toISOString()).toBe("2026-08-20T23:59:59.999Z");
  });
});

describe("DAY_MS", () => {
  it("is one day in milliseconds", () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});
