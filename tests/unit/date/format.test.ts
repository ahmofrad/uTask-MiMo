import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("date-fns-jalali", () => ({
  format: vi.fn((_date: Date, fmt: string) => {
    if (fmt === "d MMMM yyyy") return "۱۵ خرداد ۱۴۰۳";
    if (fmt === "d MMMM yyyy, HH:mm") return "۱۵ خرداد ۱۴۰۳, ۱۴:۳۰";
    return "";
  }),
}));

vi.mock("date-fns-jalali/locale", () => ({
  faIR: {},
}));

vi.mock("date-fns", () => ({
  format: vi.fn((_date: Date, fmt: string) => {
    if (fmt === "d MMMM yyyy") return "15 June 2024";
    if (fmt === "d MMMM yyyy, HH:mm") return "15 June 2024, 14:30";
    if (fmt === "MMM d, yyyy, HH:mm") return "Jun 15, 2024, 14:30";
    return "";
  }),
}));

vi.mock("date-fns/locale", () => ({
  enUS: {},
  faIR: {},
}));

import { formatDate, formatDateTime, formatRelative, toPersianDigits, formatNumber } from "@/lib/date/format";

const testDate = new Date("2024-06-15T14:30:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("formatDate", () => {
  it("returns jalali formatted string for fa-IR", () => {
    const result = formatDate(testDate, "fa-IR", "jalali");
    expect(result).toBe("۱۵ خرداد ۱۴۰۳");
  });

  it("returns gregorian formatted string for fa-IR", () => {
    const result = formatDate(testDate, "fa-IR", "gregorian");
    expect(result).toBe("15 June 2024");
  });

  it("returns gregorian formatted string for en-US", () => {
    const result = formatDate(testDate, "en-US");
    expect(result).toBe("15 June 2024");
  });

  it("defaults to jalali calendar", () => {
    const result = formatDate(testDate, "fa-IR");
    expect(result).toBe("۱۵ خرداد ۱۴۰۳");
  });

  it("renders UTC day-boundary timestamps as literal calendar days in en-US", async () => {
    const { format } = await import("date-fns");
    const formatMock = format as ReturnType<typeof vi.fn>;
    formatDate(new Date("2026-08-21T00:00:00.000Z"), "en-US"); // start marker
    formatDate(new Date("2026-08-23T23:59:59.999Z"), "en-US"); // due marker
    const days = formatMock.mock.calls.map((call) => (call[0] as Date).getDate());
    expect(days).toEqual([21, 23]);
  });

  it("renders UTC day-boundary timestamps literally in fa-IR jalali too", async () => {
    const { format } = await import("date-fns-jalali");
    const formatMock = format as ReturnType<typeof vi.fn>;
    formatDate(new Date("2026-08-23T23:59:59.999Z"), "fa-IR", "jalali");
    const arg = formatMock.mock.calls[0]?.[0] as Date;
    expect(arg.getFullYear()).toBe(2026);
    expect(arg.getMonth()).toBe(7); // August
    expect(arg.getDate()).toBe(23);
  });

  it("keeps the pinned timezone conversion for real instants", async () => {
    const { format } = await import("date-fns");
    const formatMock = format as ReturnType<typeof vi.fn>;
    // 02:00Z crosses into the previous day in America/New_York — a genuine
    // instant must still render in the pinned timezone.
    formatDate(new Date("2026-08-21T02:00:00.000Z"), "en-US");
    const arg = formatMock.mock.calls[0]?.[0] as Date;
    expect(arg.getDate()).toBe(20);
  });
});

describe("formatDateTime", () => {
  it("returns jalali formatted string with time for fa-IR", () => {
    const result = formatDateTime(testDate, "fa-IR", "jalali");
    expect(result).toBe("۱۵ خرداد ۱۴۰۳, ۱۴:۳۰");
  });

  it("returns gregorian formatted string with time for fa-IR", () => {
    const result = formatDateTime(testDate, "fa-IR", "gregorian");
    expect(result).toBe("15 June 2024, 14:30");
  });

  it("returns formatted string with time for en-US", () => {
    const result = formatDateTime(testDate, "en-US");
    expect(result).toBe("Jun 15, 2024, 14:30");
  });
});

describe("formatRelative", () => {
  it("returns 'just now' for very recent dates in en-US", () => {
    const now = new Date();
    const result = formatRelative(now, "en-US");
    expect(result).toBe("just now");
  });

  it("returns Persian 'just now' for very recent dates in fa-IR", () => {
    const now = new Date();
    const result = formatRelative(now, "fa-IR");
    expect(result).toBe("همین حالا");
  });

  it("returns minutes ago in en-US", () => {
    const now = new Date();
    const date = new Date(now.getTime() - 5 * 60 * 1000);
    const result = formatRelative(date, "en-US");
    expect(result).toBe("5m ago");
  });

  it("returns Persian minutes ago in fa-IR", () => {
    const now = new Date();
    const date = new Date(now.getTime() - 5 * 60 * 1000);
    const result = formatRelative(date, "fa-IR");
    expect(result).toBe("5 دقیقه پیش");
  });

  it("returns hours ago in en-US", () => {
    const now = new Date();
    const date = new Date(now.getTime() - 3 * 3600 * 1000);
    const result = formatRelative(date, "en-US");
    expect(result).toBe("3h ago");
  });

  it("returns Persian hours ago in fa-IR", () => {
    const now = new Date();
    const date = new Date(now.getTime() - 3 * 3600 * 1000);
    const result = formatRelative(date, "fa-IR");
    expect(result).toBe("3 ساعت پیش");
  });

  it("returns days ago in en-US", () => {
    const now = new Date();
    const date = new Date(now.getTime() - 2 * 86400 * 1000);
    const result = formatRelative(date, "en-US");
    expect(result).toBe("2d ago");
  });

  it("returns Persian days ago in fa-IR", () => {
    const now = new Date();
    const date = new Date(now.getTime() - 2 * 86400 * 1000);
    const result = formatRelative(date, "fa-IR");
    expect(result).toBe("2 روز پیش");
  });
});

describe("toPersianDigits", () => {
  it("converts digits to Persian", () => {
    expect(toPersianDigits("12345")).toBe("۱۲۳۴۵");
  });

  it("converts numeric input to Persian digits", () => {
    expect(toPersianDigits(9876)).toBe("۹۸۷۶");
  });

  it("leaves non-digit characters unchanged", () => {
    expect(toPersianDigits("abc123")).toBe("abc۱۲۳");
  });

  it("handles empty string", () => {
    expect(toPersianDigits("")).toBe("");
  });
});

describe("formatNumber", () => {
  it("formats number in en-US", () => {
    const result = formatNumber(1234567, "en-US");
    expect(result).toBe("1,234,567");
  });

  it("formats number in fa-IR without explicit Persian digits option", () => {
    const result = formatNumber(1234567, "fa-IR");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats number in fa-IR with Persian digits", () => {
    const result = formatNumber(1234567, "fa-IR", true);
    expect(result).toContain("۱");
    expect(result).toContain("۲");
  });

  it("can format a year without a grouping separator", () => {
    expect(formatNumber(1405, "fa-IR", true, false)).toBe("۱۴۰۵");
    expect(formatNumber(2026, "en-US", false, false)).toBe("2026");
  });
});
