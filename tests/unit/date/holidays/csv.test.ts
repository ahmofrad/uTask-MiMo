import { describe, it, expect } from "vitest";
import { MAX_CSV_ROWS, parseHolidayCsv, parseCsv } from "@/lib/date/holidays/csv";

describe("holiday CSV parser", () => {
  it("parses simple date,name rows", () => {
    const result = parseHolidayCsv("2026-03-20,Nowruz\n2026-08-24,Arbaeen");
    expect(result.errors).toEqual([]);
    expect(result.holidays).toEqual([
      { date: "2026-03-20", name: "Nowruz" },
      { date: "2026-08-24", name: "Arbaeen" },
    ]);
  });

  it("handles an optional header row and CRLF endings", () => {
    const result = parseHolidayCsv("date,name\r\n2026-03-20,Nowruz\r\n2026-04-01,\r\n");
    expect(result.errors).toEqual([]);
    expect(result.holidays).toEqual([
      { date: "2026-03-20", name: "Nowruz" },
      { date: "2026-04-01", name: "" },
    ]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('2026-01-01,"New Year, ""Nowruz"" edition"');
    expect(rows).toEqual([["2026-01-01", 'New Year, "Nowruz" edition']]);
  });

  it("reports per-row errors for invalid dates and keeps the valid rows", () => {
    const result = parseHolidayCsv("2026-03-20,Nowruz\n2026-13-40,Bad\nnot-a-date,X");
    expect(result.holidays).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain("invalid date");
  });

  it("rejects oversized input before importing any rows", () => {
    const result = parseHolidayCsv(Array.from({ length: MAX_CSV_ROWS + 2 }, (_, i) => `2026-01-01,Holiday ${i}`).join("\n"));
    expect(result.holidays).toEqual([]);
    expect(result.errors[0]).toContain("maximum");
  });

  it("rejects empty input", () => {
    const result = parseHolidayCsv("  \n ");
    expect(result.holidays).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
