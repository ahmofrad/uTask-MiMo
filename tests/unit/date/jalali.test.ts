import { describe, it, expect } from "vitest";

import {
  toJalali,
  toGregorian,
  getDaysInMonth,
  getMonthName,
  isLeapJalaliYear,
  getDayName,
  formatJalaliShort,
} from "@/lib/date/jalali";

describe("toJalali", () => {
  it("converts known Gregorian date to Jalali", () => {
    // 2024-03-20 is 1 Farvardin 1403 (Nowruz)
    const date = new Date(2024, 2, 20);
    const j = toJalali(date);
    expect(j.jy).toBe(1403);
    expect(j.jm).toBe(1);
    expect(j.jd).toBe(1);
  });

  it("converts 2024-06-15 correctly", () => {
    const date = new Date(2024, 5, 15);
    const j = toJalali(date);
    expect(j.jy).toBe(1403);
    expect(j.jm).toBe(3);
    expect(j.jd).toBe(26);
  });

  it("handles end-of-year date", () => {
    const date = new Date(2024, 11, 31);
    const j = toJalali(date);
    expect(j.jy).toBe(1403);
    expect(j.jm).toBe(10);
    expect(j.jd).toBe(11);
  });
});

describe("toGregorian", () => {
  it("converts 1 Farvardin 1403 to 2024-03-20", () => {
    const date = toGregorian(1403, 1, 1);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(20);
  });

  it("is the inverse of toJalali", () => {
    const original = new Date(2024, 5, 15);
    const j = toJalali(original);
    const g = toGregorian(j.jy, j.jm, j.jd);
    expect(g.getFullYear()).toBe(original.getFullYear());
    expect(g.getMonth()).toBe(original.getMonth());
    expect(g.getDate()).toBe(original.getDate());
  });
});

describe("getDaysInMonth", () => {
  it("returns 31 for months 1-6 (spring/summer)", () => {
    expect(getDaysInMonth(1403, 1)).toBe(31);
    expect(getDaysInMonth(1403, 3)).toBe(31);
    expect(getDaysInMonth(1403, 6)).toBe(31);
  });

  it("returns 30 for months 7-11 (autumn/winter)", () => {
    expect(getDaysInMonth(1403, 7)).toBe(30);
    expect(getDaysInMonth(1403, 9)).toBe(30);
    expect(getDaysInMonth(1403, 11)).toBe(30);
  });

  it("returns 30 for month 12 in leap year", () => {
    // 1403 is a leap year (25*1403+11=35086, 35086%33=2, m=2 < 8 → leap)
    expect(isLeapJalaliYear(1403)).toBe(true);
    expect(getDaysInMonth(1403, 12)).toBe(30);
  });

  it("returns 29 for month 12 in non-leap year", () => {
    expect(isLeapJalaliYear(1402)).toBe(false);
    expect(getDaysInMonth(1402, 12)).toBe(29);
  });
});

describe("isLeapJalaliYear", () => {
  it("returns true for leap year 1403", () => {
    expect(isLeapJalaliYear(1403)).toBe(true);
  });

  it("returns false for non-leap year 1402", () => {
    expect(isLeapJalaliYear(1402)).toBe(false);
  });
});

describe("getMonthName", () => {
  it("returns Persian month name for fa-IR", () => {
    expect(getMonthName(1, "fa-IR")).toBe("فروردین");
    expect(getMonthName(6, "fa-IR")).toBe("شهریور");
    expect(getMonthName(12, "fa-IR")).toBe("اسفند");
  });

  it("returns English month name for en-US", () => {
    expect(getMonthName(1, "en-US")).toBe("Farvardin");
    expect(getMonthName(6, "en-US")).toBe("Shahrivar");
    expect(getMonthName(12, "en-US")).toBe("Esfand");
  });

  it("returns empty string for invalid month", () => {
    expect(getMonthName(13, "fa-IR")).toBe("");
    expect(getMonthName(0, "en-US")).toBe("");
  });
});

describe("getDayName", () => {
  it("returns Persian day names for fa-IR", () => {
    expect(getDayName(0, "fa-IR")).toBe("شنبه");
    expect(getDayName(6, "fa-IR")).toBe("جمعه");
  });

  it("returns English day abbreviations for en-US", () => {
    expect(getDayName(0, "en-US")).toBe("Sat");
    expect(getDayName(6, "en-US")).toBe("Fri");
  });

  it("returns empty string for invalid index", () => {
    expect(getDayName(7, "fa-IR")).toBe("");
  });
});

describe("formatJalaliShort", () => {
  it("formats date as YYYY/MM/DD", () => {
    const date = new Date(2024, 2, 20);
    const result = formatJalaliShort(date, "fa-IR");
    expect(result).toBe("1403/01/01");
  });

  it("pads month and day with leading zeros", () => {
    const date = new Date(2024, 0, 5);
    const result = formatJalaliShort(date, "en-US");
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});
