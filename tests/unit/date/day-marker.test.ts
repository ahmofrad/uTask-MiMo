import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  diffCalendarDays,
  isLocalEndOfDay,
  isLocalStartOfDay,
  isSameCalendarDay,
  isUtcDayMarker,
  isUtcEndMarker,
  isUtcStartMarker,
  parseDateOnly,
  snapToDayBoundary,
  startOfCalendarDay,
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

describe("local wall-clock checks", () => {
  it("detects local midnight", () => {
    const midnight = new Date("2026-08-21T00:00:00.000Z");
    // When the runtime is UTC, the local wall clock matches the UTC clock.
    expect(isLocalStartOfDay(midnight)).toBe(new Date(midnight).getHours() === 0);
  });

  it("detects local 23:59:59 regardless of milliseconds", () => {
    expect(isLocalEndOfDay(new Date("2026-08-21T23:59:59.000Z"))).toBe(true);
    expect(isLocalEndOfDay(new Date("2026-08-21T23:59:59.999Z"))).toBe(true);
    expect(isLocalEndOfDay(new Date("2026-08-21T23:59:58.999Z"))).toBe(false);
  });
});

describe("calendar day helpers", () => {
  it("zeroes the local clock", () => {
    const result = startOfCalendarDay(new Date("2026-08-21T14:30:00.000Z"));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    // Same UTC instant day as the input in a UTC runtime.
    expect(result.getUTCDate()).toBe(21);
  });

  it("counts whole calendar days between dates", () => {
    expect(diffCalendarDays(
      new Date("2026-08-19T00:00:00.000Z"),
      new Date("2026-08-21T00:00:00.000Z"),
    )).toBe(2);
    expect(diffCalendarDays(
      new Date("2026-08-21T23:00:00.000Z"),
      new Date("2026-08-19T01:00:00.000Z"),
    )).toBe(-2);
  });

  it("compares calendar days, ignoring time of day", () => {
    expect(isSameCalendarDay(
      new Date("2026-08-21T08:00:00.000Z"),
      new Date("2026-08-21T23:59:00.000Z"),
    )).toBe(true);
    expect(isSameCalendarDay(
      new Date("2026-08-21T23:59:00.000Z"),
      new Date("2026-08-22T00:01:00.000Z"),
    )).toBe(false);
  });
});

describe("snapToDayBoundary", () => {
  it("snaps a start to local midnight and a due to local 23:59:59.999", () => {
    const timestamp = new Date("2026-08-19T12:34:56.789Z");
    expect(snapToDayBoundary(timestamp, "start").toISOString()).toBe("2026-08-19T00:00:00.000Z");
    expect(snapToDayBoundary(timestamp, "end").toISOString()).toBe("2026-08-19T23:59:59.999Z");
  });
});

describe("date-only round trips", () => {
  it("formats a date as yyyy-MM-dd", () => {
    expect(toDateOnly(new Date("2026-08-05T00:00:00.000Z"))).toBe("2026-08-05");
    expect(toDateOnly(new Date("2026-11-30T00:00:00.000Z"))).toBe("2026-11-30");
  });

  it("parses yyyy-MM-dd back into a local midnight timestamp", () => {
    const parsed = parseDateOnly("2026-08-05");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7); // August
    expect(parsed.getDate()).toBe(5);
  });

  it("round-trips through toDateOnly and parseDateOnly", () => {
    const original = new Date("2026-08-05T00:00:00.000Z");
    expect(toDateOnly(parseDateOnly(toDateOnly(original)))).toBe("2026-08-05");
  });
});

describe("DAY_MS", () => {
  it("is one day in milliseconds", () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});
