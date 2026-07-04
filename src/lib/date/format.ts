import { format as formatGregorian } from "date-fns";
import { format as formatJalali } from "date-fns-jalali";
import { enUS } from "date-fns/locale";
import { faIR as faIRGregorian } from "date-fns/locale";
import { faIR as faIRJalali } from "date-fns-jalali/locale";

export type Locale = "fa-IR" | "en-US";
export type Calendar = "jalali" | "gregorian";

export function formatDate(
  date: Date,
  locale: Locale,
  calendar: Calendar = "jalali",
): string {
  if (locale === "fa-IR" && calendar === "jalali") {
    return formatJalali(date, "PPP", { locale: faIRJalali });
  }
  if (locale === "fa-IR" && calendar === "gregorian") {
    return formatGregorian(date, "PPP", { locale: faIRGregorian });
  }
  return formatGregorian(date, "PPP", { locale: enUS });
}

export function formatDateTime(
  date: Date,
  locale: Locale,
  calendar: Calendar = "jalali",
): string {
  const datePattern = locale === "fa-IR" ? "PPP p" : "MMM d, yyyy, h:mm a";
  if (locale === "fa-IR" && calendar === "jalali") {
    return formatJalali(date, datePattern, { locale: faIRJalali });
  }
  if (locale === "fa-IR" && calendar === "gregorian") {
    return formatGregorian(date, datePattern, { locale: faIRGregorian });
  }
  return formatGregorian(date, datePattern, { locale: enUS });
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
  return formatDate(date, locale, "jalali").slice(0, 10);
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
