"use client";

import { useLocale } from "next-intl";
import { formatDate, formatDateTime, type Locale } from "@/lib/date/format";

export function useFormattedDate() {
  const locale = useLocale() as Locale;

  function date(value: string | Date | null): string {
    if (!value) return "";
    const d = typeof value === "string" ? new Date(value) : value;
    return formatDate(d, locale);
  }

  function dateTime(value: string | Date | null): string {
    if (!value) return "";
    const d = typeof value === "string" ? new Date(value) : value;
    return formatDateTime(d, locale);
  }

  function shortDate(value: string | Date | null): string {
    if (!value) return "";
    const d = typeof value === "string" ? new Date(value) : value;
    return formatDate(d, locale);
  }

  return { date, dateTime, shortDate };
}
