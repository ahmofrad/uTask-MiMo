import { format as formatGregorian } from "date-fns";
import { format as formatJalali } from "date-fns-jalali";
import { enUS } from "date-fns/locale";
import { faIR as faIRGregorian } from "date-fns/locale";
import { faIR as faIRJalali } from "date-fns-jalali/locale";

export type Locale = "fa-IR" | "en-US";
export type Calendar = "jalali" | "gregorian";

// Pin a canonical timezone per locale so server (UTC runtime) and client
// (browser local zone) render identical date strings and avoid hydration
// mismatches.
const TIMEZONE_BY_LOCALE: Record<Locale, string> = {
  "fa-IR": "Asia/Tehran",
  "en-US": "America/New_York",
};

// Convert an absolute instant into a Date whose *local* wall-clock equals the
// wall-clock time in `timeZone`. date-fns formats local components, so this
// makes the output deterministic regardless of the runtime's own timezone.
function toZonedDate(date: Date, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return new Date(`${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`);
}

export function formatDate(
  date: Date,
  locale: Locale,
  calendar: Calendar = "jalali",
): string {
  const d = toZonedDate(date, TIMEZONE_BY_LOCALE[locale]);
  if (locale === "fa-IR" && calendar === "jalali") {
    return formatJalali(d, "d MMMM yyyy", { locale: faIRJalali });
  }
  if (locale === "fa-IR" && calendar === "gregorian") {
    return formatGregorian(d, "d MMMM yyyy", { locale: faIRGregorian });
  }
  return formatGregorian(d, "d MMMM yyyy", { locale: enUS });
}

export function formatDateTime(
  date: Date,
  locale: Locale,
  calendar: Calendar = "jalali",
): string {
  const d = toZonedDate(date, TIMEZONE_BY_LOCALE[locale]);
  if (locale === "fa-IR" && calendar === "jalali") {
    return formatJalali(d, "d MMMM yyyy, HH:mm", { locale: faIRJalali });
  }
  if (locale === "fa-IR" && calendar === "gregorian") {
    return formatGregorian(d, "d MMMM yyyy, HH:mm", { locale: faIRGregorian });
  }
  return formatGregorian(d, "MMM d, yyyy, HH:mm", { locale: enUS });
}

export function formatRelative(
  date: Date,
  locale: Locale,
): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 60000) return locale === "fa-IR" ? "همین حالا" : "just now";
  if (diffMs < 3600000) {
    const mins = Math.floor(diffMs / 60000);
    return locale === "fa-IR" ? `${mins} دقیقه پیش` : `${mins}m ago`;
  }
  if (diffMs < 86400000) {
    const hours = Math.floor(diffMs / 3600000);
    return locale === "fa-IR" ? `${hours} ساعت پیش` : `${hours}h ago`;
  }
  if (diffDays < 7) {
    return locale === "fa-IR" ? `${diffDays} روز پیش` : `${diffDays}d ago`;
  }
  return formatDate(date, locale, "jalali");
}

const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => persianDigits[+d] ?? d);
}

export function formatNumber(
  value: number,
  locale: Locale,
  usePersianDigits = false,
): string {
  const formatted = new Intl.NumberFormat(locale === "fa-IR" ? "fa-IR" : "en-US", {
    useGrouping: true,
  }).format(value);
  if (locale === "fa-IR" && usePersianDigits) {
    return toPersianDigits(formatted);
  }
  return formatted;
}
