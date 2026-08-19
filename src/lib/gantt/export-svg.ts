import type { GanttReport } from "@/lib/gantt-types";
import { getMonthName, toJalali, formatJalaliShort } from "@/lib/date/jalali";
import { formatNumber, type Locale } from "@/lib/date/format";
import {
  diffCalendarDays,
  normalizeStoredDayMarker,
  startOfCalendarDay,
  timelineDayStart,
} from "@/lib/date/day-marker";
import { getTimelineItemGeometry, getTimelinePosition, type TimelineDirection } from "@/lib/gantt/timeline";
import { linkShortLabel } from "@/lib/gantt/links";
import type { WorkingDayConfig } from "@/lib/date/working-day";
import { createWorkingDayCalendar } from "@/lib/date/working-day-calendar";

const DAY_WIDTH = 52;
const BOX_WIDTH = 64;
const LEFT_WIDTH = 288;
const ROW_HEIGHT = 52;

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
  fontSans: "system-ui, sans-serif",
  fontMono: "ui-monospace, monospace",
};

const STATUS_FILL: Record<string, keyof ExportPalette> = {
  open: "info",
  in_progress: "warning",
  done: "success",
  cancelled: "fgSubtle",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function shortEnDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()] ?? ""} ${date.getDate()}`;
}

function shortDateFor(date: Date, locale: Locale): string {
  return locale === "fa-IR" ? formatJalaliShort(date, locale) : shortEnDate(date);
}

/**
 * Renders a standalone SVG copy of the Gantt chart from the report data —
 * same geometry as the interactive chart, but fully self-contained (inline
 * colors, no external CSS) so it can be rasterized for PNG/PDF export.
 *
 * Pure module: no DOM access. The palette is either passed in (the browser
 * adapter resolves the live design tokens) or falls back to FALLBACK_PALETTE,
 * so the SVG geometry can be unit-tested in Node.
 */
export function buildGanttExportSvg(options: {
  report: GanttReport;
  locale: Locale;
  palette?: ExportPalette;
  /** Explicit time window; defaults to the tasks' span padded by 7/90 days. */
  rangeStart?: Date;
  rangeEnd?: Date;
  /** Working-day calendar; non-working days and holidays are shaded. */
  workingDays?: WorkingDayConfig;
}): string {
  const { report, locale } = options;
  const palette = options.palette ?? FALLBACK_PALETTE;
  const direction: TimelineDirection = locale === "fa-IR" ? "rtl" : "ltr";
  const rows = report.tasks;
  const workingDayCalendar = createWorkingDayCalendar(options.workingDays, locale);

  const today = startOfCalendarDay(new Date());
  let rangeStart: Date;
  let rangeEnd: Date;
  if (options.rangeStart && options.rangeEnd) {
    // Explicit range (e.g. the chosen export month) is honored exactly.
    rangeStart = startOfCalendarDay(options.rangeStart);
    rangeEnd = startOfCalendarDay(options.rangeEnd);
  } else {
    const withDates = rows.flatMap((row) => {
      const start = row.startDate ?? row.summaryStart;
      const end = row.dueDate ?? row.summaryEnd;
      return [start, end].filter(Boolean).map((d) => new Date(d as string));
    });
    rangeStart = withDates.length ? new Date(Math.min(...withDates.map((d) => d.getTime()))) : today;
    rangeEnd = withDates.length ? new Date(Math.max(...withDates.map((d) => d.getTime()))) : today;
    // Day markers anchor to their UTC calendar day so the range covers the
    // cells the bars actually occupy in every timezone.
    rangeStart = timelineDayStart(rangeStart);
    rangeEnd = timelineDayStart(rangeEnd);
    rangeStart.setDate(rangeStart.getDate() - 7);
    rangeEnd.setDate(rangeEnd.getDate() + 90);
  }
  const totalDays = Math.max(diffCalendarDays(rangeStart, rangeEnd), 14);
  const dayCount = totalDays + 1;
  const totalWidth = dayCount * DAY_WIDTH;
  const rowsHeight = rows.length * ROW_HEIGHT;
  const svgWidth = totalWidth + LEFT_WIDTH;

  const timelineOrigin = direction === "rtl" ? 0 : LEFT_WIDTH;
  const timelineX = (offset: number, itemWidth = DAY_WIDTH): number =>
    getTimelinePosition(offset, totalDays, DAY_WIDTH, direction, itemWidth);

  const dayOffset = (date: Date | string | null): number | null => {
    if (!date) return null;
    return Math.max(0, Math.min(totalDays, diffCalendarDays(rangeStart, timelineDayStart(new Date(date)))));
  };

  const dayPos = (date: Date | string | null, itemWidth = DAY_WIDTH): number => {
    const offset = dayOffset(date);
    if (offset == null) return 0;
    return getTimelinePosition(offset, totalDays, DAY_WIDTH, direction, itemWidth);
  };

  // Month + day header cells.
  const months: { key: string; label: string; startOffset: number; dayCount: number }[] = [];
  const days: { date: Date; offset: number; label: string; isMonthStart: boolean; isToday: boolean }[] = [];
  const cursor = new Date(rangeStart);
  let previousMonthKey = "";
  for (let offset = 0; offset < dayCount; offset++) {
    const date = new Date(cursor);
    const jalali = toJalali(date);
    const monthKey = `${jalali.jy}-${jalali.jm}`;
    const isMonthStart = monthKey !== previousMonthKey;
    days.push({
      date,
      offset,
      label: formatNumber(jalali.jd, locale, locale === "fa-IR"),
      isMonthStart,
      isToday: date.getTime() === today.getTime(),
    });
    const currentMonth = months[months.length - 1];
    if (isMonthStart || !currentMonth) {
      months.push({
        key: monthKey,
        label: `${getMonthName(jalali.jm, locale)} ${formatNumber(jalali.jy, locale, locale === "fa-IR", false)}`,
        startOffset: offset,
        dayCount: 1,
      });
    } else {
      currentMonth.dayCount += 1;
    }
    previousMonthKey = monthKey;
    cursor.setDate(cursor.getDate() + 1);
  }

  const parts: string[] = [];
  // The resolved font tokens contain quotes (e.g. "Vazirmatn") which must be
  // escaped inside the XML attribute or the SVG is invalid and won't load.
  const fontSans = escapeXml(palette.fontSans);
  const fontMono = escapeXml(palette.fontMono);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${rowsHeight + 80}" ` +
      `viewBox="0 0 ${svgWidth} ${rowsHeight + 80}" font-family="${fontSans}" dir="${direction}">`,
  );
  parts.push(`<defs>
  <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
    <path d="M0,0 L6,3 L0,6 Z" fill="${palette.fgSubtle}" />
  </marker>
</defs>`);
  parts.push(`<rect x="0" y="0" width="${svgWidth}" height="${rowsHeight + 80}" fill="${palette.bgApp}" />`);

  // Header.
  parts.push(`<rect x="0" y="0" width="${svgWidth}" height="80" fill="${palette.bgSurface2}" />`);
  parts.push(
    `<rect x="0" y="0" width="${LEFT_WIDTH}" height="80" fill="${palette.bgSurface2}" stroke="${palette.border}" />`,
  );
  parts.push(
    `<text x="${direction === "rtl" ? svgWidth - 16 : 16}" y="34" font-size="13" font-weight="600" fill="${palette.fgMuted}">Tasks</text>`,
  );
  // Month blocks.
  for (const month of months) {
    const width = month.dayCount * DAY_WIDTH;
    const x = timelineOrigin + timelineX(month.startOffset, width);
    parts.push(
      `<rect x="${x}" y="0" width="${width}" height="36" fill="${palette.bgSurface2}" stroke="${palette.border}" />`,
    );
    parts.push(
      `<text x="${x + width / 2}" y="24" font-size="13" font-weight="700" fill="${palette.fgPrimary}" text-anchor="middle">${escapeXml(month.label)}</text>`,
    );
  }
  // Day cells.
  for (const day of days) {
    const x = timelineOrigin + timelineX(day.offset, DAY_WIDTH);
    const holidayName = workingDayCalendar.holidayName(day.date);
    const isNonWorking = workingDayCalendar.isNonWorking(day.date);
    const dayFill = day.isToday
      ? palette.accentBg
      : isNonWorking
        ? holidayName !== null
          ? palette.warningBg
          : palette.bgSurface2
        : palette.bgSurface;
    const labelFill = day.isToday ? palette.accent : isNonWorking && holidayName ? palette.warning : palette.fgMuted;
    parts.push(
      `<rect x="${x}" y="36" width="${DAY_WIDTH}" height="44" fill="${dayFill}" stroke="${palette.border}" />`,
    );
    parts.push(
      `<text x="${x + DAY_WIDTH / 2}" y="63" font-size="12" font-weight="600" fill="${labelFill}" text-anchor="middle">${day.label}</text>`,
    );
  }
  // Today line.
  const todayOffset = diffCalendarDays(rangeStart, today);
  if (todayOffset >= 0 && todayOffset < dayCount) {
    const x = timelineOrigin + timelineX(todayOffset, DAY_WIDTH) + DAY_WIDTH / 2;
    parts.push(
      `<line x1="${x}" y1="80" x2="${x}" y2="${rowsHeight + 80}" stroke="${palette.danger}" stroke-width="1.5" opacity="0.6" />`,
    );
  }

  const rowIndex = new Map<string, number>();
  rows.forEach((row, i) => rowIndex.set(row.id, i));

  // Rows: label column + non-working day shading + bars.
  rows.forEach((row, i) => {
    const y = 80 + i * ROW_HEIGHT;
    const fill = row.isSummary ? palette.bgSurface2 : palette.bgSurface;
    parts.push(
      `<rect x="0" y="${y}" width="${svgWidth}" height="${ROW_HEIGHT}" fill="${fill}" stroke="${palette.border}" />`,
    );
    parts.push(
      `<rect x="0" y="${y}" width="${LEFT_WIDTH}" height="${ROW_HEIGHT}" fill="${palette.bgSurface}" stroke="${palette.border}" />`,
    );
    // Shade today, holidays, and non-working days behind the bars.
    for (const day of days) {
      const holidayName = workingDayCalendar.holidayName(day.date);
      if (!day.isToday && !workingDayCalendar.isNonWorking(day.date)) continue;
      const x = timelineOrigin + timelineX(day.offset, DAY_WIDTH);
      const cellFill = holidayName !== null
        ? palette.warningBg
        : day.isToday
          ? palette.accentBg
          : palette.bgSurface2;
      parts.push(
        `<rect x="${x}" y="${y}" width="${DAY_WIDTH}" height="${ROW_HEIGHT}" fill="${cellFill}" opacity="${day.isToday ? 0.4 : 0.55}" />`,
      );
    }
    parts.push(
      `<text x="${direction === "rtl" ? svgWidth - 16 : 16}" y="${y + 24}" font-size="10" font-family="${fontMono}" fill="${palette.fgSubtle}">${escapeXml(row.wbsCode)}</text>`,
    );
    parts.push(
      `<text x="${direction === "rtl" ? svgWidth - 58 : 58}" y="${y + 24}" font-size="12" font-weight="500" fill="${palette.fgPrimary}">${escapeXml(truncate(row.title, 30))}</text>`,
    );
    const rowStart = row.startDate ?? row.summaryStart;
    const rowEnd = row.dueDate ?? row.summaryEnd;
    const startLabel = rowStart ?? rowEnd;
    const endLabel = rowEnd ?? rowStart;
    if (startLabel && endLabel) {
      // Normalize legacy non-canonical markers so the label shows the intended
      // calendar day in every timezone, matching the bar's cell position.
      const startLabelDate = normalizeStoredDayMarker(new Date(startLabel));
      const endLabelDate = normalizeStoredDayMarker(new Date(endLabel));
      parts.push(
        `<text x="${direction === "rtl" ? svgWidth - 16 : 16}" y="${y + 40}" font-size="10" fill="${palette.fgMuted}">${escapeXml(shortDateFor(startLabelDate, locale))} – ${escapeXml(shortDateFor(endLabelDate, locale))}</text>`,
      );
    }

    const start = rowStart ? new Date(rowStart) : rowEnd ? new Date(rowEnd) : null;
    if (!start) return;
    const end = rowEnd ? new Date(rowEnd) : new Date(rowStart!);
    const geometry = getTimelineItemGeometry(start, end, rangeStart, DAY_WIDTH);
    const barLeft = timelineOrigin + timelineX(geometry.startOffset, geometry.width);
    const barTop = y + 10;
    const barHeight = 28;
    const isCritical = row.critical === true;

    if (row.isMilestone) {
      const mx = timelineOrigin + dayPos(rowStart ?? rowEnd ?? null, DAY_WIDTH) + DAY_WIDTH / 2;
      const diamond = `${mx},${y + 24} ${mx + 8},${y + 32} ${mx},${y + 40} ${mx - 8},${y + 32}`;
      parts.push(
        `<polygon points="${diamond}" fill="${palette.accent}" stroke="${isCritical ? palette.danger : palette.bgSurface}" stroke-width="1.5" />`,
      );
      return;
    }

    const colorKey = STATUS_FILL[row.status] ?? "info";
    const fillColor = palette[colorKey];
    const radius = 6;
    parts.push(
      `<rect x="${barLeft}" y="${barTop}" width="${geometry.width}" height="${barHeight}" rx="${radius}" fill="${fillColor}"${isCritical ? ` stroke="${palette.danger}" stroke-width="2"` : ""} />`,
    );
    if (row.progress > 0) {
      const progressWidth = Math.max(0, Math.min(geometry.width, (row.progress / 100) * geometry.width));
      parts.push(
        `<rect x="${barLeft}" y="${barTop}" width="${progressWidth}" height="${barHeight}" rx="${radius}" fill="#000000" opacity="0.2" />`,
      );
    }
  });

  // Dependency arrows + labels.
  for (const link of report.links) {
    const sRow = rowIndex.get(link.source);
    const tRow = rowIndex.get(link.target);
    if (sRow == null || tRow == null) continue;
    const sTask = rows[sRow];
    const tTask = rows[tRow];
    if (!sTask || !tTask) continue;
    const sEnd = (sTask.dueDate ?? sTask.summaryEnd) ? new Date(sTask.dueDate ?? sTask.summaryEnd!) : (sTask.startDate ? new Date(sTask.startDate) : null);
    const tStart = (tTask.startDate ?? tTask.summaryStart) ? new Date(tTask.startDate ?? tTask.summaryStart!) : (tTask.dueDate ? new Date(tTask.dueDate) : null);
    if (!sEnd || !tStart) continue;
    const sourcePosition = dayPos(sEnd.toISOString(), BOX_WIDTH);
    const targetPosition = dayPos(tStart.toISOString(), 0);
    const x1 = timelineOrigin + (direction === "rtl" ? sourcePosition : sourcePosition + BOX_WIDTH);
    const y1 = 80 + sRow * ROW_HEIGHT + ROW_HEIGHT / 2;
    const x2 = timelineOrigin + targetPosition;
    const y2 = 80 + tRow * ROW_HEIGHT + ROW_HEIGHT / 2;
    const mx = (x1 + x2) / 2;
    const path = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    const invalid = sEnd.getTime() > tStart.getTime();
    parts.push(
      `<path d="${path}" fill="none" stroke="${invalid ? palette.danger : palette.fgSubtle}" stroke-width="1.5" marker-end="url(#gantt-arrow)" />`,
    );
    parts.push(
      `<text x="${mx}" y="${(y1 + y2) / 2 - 5}" font-size="10" font-family="${fontMono}" fill="${palette.fgSubtle}" stroke="${palette.bgSurface}" stroke-width="3" paint-order="stroke" text-anchor="middle">${escapeXml(linkShortLabel(link))}</text>`,
    );
  }

  parts.push("</svg>");
  return parts.join("\n");
}
