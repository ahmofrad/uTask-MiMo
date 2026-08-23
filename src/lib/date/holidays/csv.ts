import type { HolidayEntry } from "@/lib/date/working-day-calendar";

/**
 * Minimal CSV parsing for holiday imports. Handles quoted fields, escaped
 * quotes, CRLF and LF line endings, and an optional header row. No
 * dependencies — a ~40-line RFC-4180 subset is all an import needs.
 *
 * Expected columns: `date,name` (date is `yyyy-MM-dd`, name optional).
 * A leading `name,date` header is tolerated by detecting the first row's
 * fields and mapping by header names when present.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (char === "\r") {
      // Ignore; the following \n ends the row.
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return (
    parsed.getFullYear() === year
    && parsed.getMonth() === (month ?? 1) - 1
    && parsed.getDate() === day
  );
}

export const MAX_CSV_ROWS = 10_000;

export type CsvImportResult = {
  holidays: HolidayEntry[];
  errors: string[];
};

/**
 * Extracts `date,name` rows from CSV text. Returns the valid holidays plus
 * per-row error messages for the ones that could not be parsed.
 */
export function parseHolidayCsv(text: string): CsvImportResult {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length > MAX_CSV_ROWS + 1) {
    return {
      holidays: [],
      errors: [`CSV contains ${rows.length} rows; the maximum is ${MAX_CSV_ROWS}`],
    };
  }
  if (rows.length === 0) {
    return { holidays: [], errors: ["CSV is empty"] };
  }

  // Detect a header row: if the first row has a cell matching "date",
  // treat it as a header and map columns by name; otherwise assume `date,name`.
  const first = rows[0]!.map((cell) => cell.trim().toLowerCase());
  const hasHeader = first.includes("date");
  const dateIndex = hasHeader
    ? first.indexOf("date")
    : 0;
  const nameIndex = hasHeader
    ? first.indexOf("name")
    : 1;

  const holidays: HolidayEntry[] = [];
  const errors: string[] = [];
  rows.slice(hasHeader ? 1 : 0).forEach((row, index) => {
    const line = index + (hasHeader ? 2 : 1);
    const date = row[dateIndex]?.trim() ?? "";
    if (!isValidDate(date)) {
      errors.push(`Line ${line}: invalid date "${date}" (expected yyyy-MM-dd)`);
      return;
    }
    const name = (row[nameIndex]?.trim() ?? "").slice(0, 255);
    holidays.push({ date, name });
  });

  return { holidays, errors };
}
