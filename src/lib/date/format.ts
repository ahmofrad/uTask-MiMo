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
    return formatJalali(date, "d MMMM yyyy", { locale: faIRJalali });
  }
  if (locale === "fa-IR" && calendar === "gregorian") {
    return formatGregorian(date, "d MMMM yyyy", { locale: faIRGregorian });
  }
  return formatGregorian(date, "d MMMM yyyy", { locale: enUS });
}

export function formatDateTime(
  date: Date,
  locale: Locale,
  calendar: Calendar = "jalali",
): string {
  if (locale === "fa-IR" && calendar === "jalali") {
    return formatJalali(date, "d MMMM yyyy, HH:mm", { locale: faIRJalali });
  }
  if (locale === "fa-IR" && calendar === "gregorian") {
    return formatGregorian(date, "d MMMM yyyy, HH:mm", { locale: faIRGregorian });
  }
  return formatGregorian(date, "MMM d, yyyy, HH:mm", { locale: enUS });
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
