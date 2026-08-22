import { formatJalaliShort } from "@/lib/date/jalali";
import type { Locale } from "@/lib/date/format";

export type ExportPalette = {
  bgApp: string;
  bgSurface: string;
  bgSurface2: string;
  fgPrimary: string;
  fgMuted: string;
  fgSubtle: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentBg: string;
  info: string;
  warning: string;
  warningBg: string;
  success: string;
  danger: string;
  dangerBg: string;
  fontSans: string;
  fontMono: string;
};

export const FALLBACK_PALETTE: ExportPalette = {
  bgApp: "#f4f6ff",
  bgSurface: "#ffffff",
  bgSurface2: "#eef2ff",
  fgPrimary: "#17213b",
  fgMuted: "#4f5d79",
  fgSubtle: "#53617d",
  border: "#dce3f3",
  borderStrong: "#c6d0e8",
  accent: "#4f46e5",
  accentBg: "#e0e7ff",
  info: "#0369a1",
  warning: "#854d0e",
  warningBg: "#fef3c7",
  success: "#15803d",
  danger: "#b91c1c",
  dangerBg: "#fee2e2",
  fontSans: "system-ui, sans-serif",
  fontMono: "ui-monospace, monospace",
};

export const STATUS_FILL: Record<string, keyof ExportPalette> = {
  open: "info",
  in_progress: "warning",
  done: "success",
  cancelled: "fgSubtle",
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortEnDate(date: Date): string {
  return `${EN_MONTHS[date.getMonth()] ?? ""} ${date.getDate()}`;
}

export function shortDateFor(date: Date, locale: Locale): string {
  return locale === "fa-IR" ? formatJalaliShort(date, locale) : shortEnDate(date);
}