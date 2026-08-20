import { describe, expect, it } from "vitest";
import {
  childRule,
  decodeRecurrenceRule,
  encodeRecurrenceRule,
  nextOccurrenceDate,
  shouldSpawnNext,
} from "@/lib/tasks/recurrence";
import { DAY_MS, timelineDayStart } from "@/lib/date/day-marker";

const rule = (overrides: Partial<Record<string, unknown>> = {}) =>
  decodeRecurrenceRule(
    encodeRecurrenceRule(
      decodeRecurrenceRule(
        JSON.stringify({ freq: "DAILY", interval: 1, anchor: "dueDate", ...overrides }),
      )!,
    ),
  )!;

describe("decodeRecurrenceRule / encodeRecurrenceRule", () => {
  it("round-trips a valid rule", () => {
    const encoded = encodeRecurrenceRule({ freq: "WEEKLY", interval: 2, anchor: "startDate" });
    const decoded = decodeRecurrenceRule(encoded);
    expect(decoded).toEqual({ freq: "WEEKLY", interval: 2, anchor: "startDate" });
  });

  it("applies defaults (interval 1, anchor dueDate)", () => {
    const decoded = decodeRecurrenceRule(JSON.stringify({ freq: "DAILY" }));
    expect(decoded).toEqual({ freq: "DAILY", interval: 1, anchor: "dueDate" });
  });

  it("returns null for invalid or empty input", () => {
    expect(decodeRecurrenceRule(null)).toBeNull();
    expect(decodeRecurrenceRule(undefined)).toBeNull();
    expect(decodeRecurrenceRule("not json")).toBeNull();
    expect(decodeRecurrenceRule(JSON.stringify({ freq: "HOURLY" }))).toBeNull();
  });
});

describe("nextOccurrenceDate", () => {
  it("advances daily by the interval and preserves the due boundary", () => {
    const anchor = new Date("2026-08-20T23:59:59.999Z");
    const next = nextOccurrenceDate(rule({ freq: "DAILY", interval: 2 }), anchor);
    expect(timelineDayStart(next).getTime() - timelineDayStart(anchor).getTime()).toBe(2 * DAY_MS);
    expect(next.getUTCHours()).toBe(23); // due boundary preserved
  });

  it("advances weekly (7 days per interval)", () => {
    const anchor = new Date("2026-08-20T00:00:00.000Z");
    const next = nextOccurrenceDate(rule({ freq: "WEEKLY", interval: 2, anchor: "startDate" }), anchor);
    expect(timelineDayStart(next).getTime() - timelineDayStart(anchor).getTime()).toBe(14 * DAY_MS);
    expect(next.getUTCHours()).toBe(0); // start boundary preserved
  });

  it("advances monthly and clamps to the end of a shorter month", () => {
    const anchor = new Date("2026-01-31T00:00:00.000Z");
    const next = nextOccurrenceDate(rule({ freq: "MONTHLY", interval: 1, anchor: "startDate" }), anchor);
    expect(timelineDayStart(next).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("shouldSpawnNext + childRule", () => {
  const anchor = new Date("2026-08-20T00:00:00.000Z");

  it("allows unlimited spawns when count and endDate are unset", () => {
    const r = rule({ freq: "DAILY" });
    const next = nextOccurrenceDate(r, anchor);
    expect(shouldSpawnNext(r, next)).toBe(true);
    expect(childRule(r)).toEqual(r);
  });

  it("stops when count is exhausted", () => {
    const r = rule({ freq: "DAILY", count: 0 });
    const next = nextOccurrenceDate(r, anchor);
    expect(shouldSpawnNext(r, next)).toBe(false);
    expect(childRule(r)).toBeNull();
  });

  it("decrements count on each spawned child", () => {
    const r = rule({ freq: "DAILY", count: 2 });
    expect(childRule(r)).toEqual({ freq: "DAILY", interval: 1, anchor: "dueDate", count: 1 });
  });

  it("stops when the next occurrence passes endDate", () => {
    const r = rule({ freq: "DAILY", endDate: "2026-08-20" });
    const next = nextOccurrenceDate(r, anchor);
    expect(shouldSpawnNext(r, next)).toBe(false);
  });

  it("spawns when the next occurrence is still within endDate", () => {
    const r = rule({ freq: "DAILY", endDate: "2026-08-22" });
    const next = nextOccurrenceDate(r, anchor);
    expect(shouldSpawnNext(r, next)).toBe(true);
  });
});
