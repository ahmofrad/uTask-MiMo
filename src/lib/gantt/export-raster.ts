import type { GanttReport } from "@/lib/gantt-types";
import type { Locale } from "@/lib/date/format";
import type { WorkingDayConfig } from "@/lib/date/working-day";
import {
  buildGanttExportSvg,
  FALLBACK_PALETTE,
  type ExportPalette,
} from "@/lib/gantt/export-svg";
import { buildJpegPdf } from "@/lib/pdf/simple";

/** Resolve the design tokens currently applied to the page into literal colors. */
export function resolveExportPalette(): ExportPalette {
  if (typeof document === "undefined") return FALLBACK_PALETTE;
  const css = getComputedStyle(document.documentElement);
  const value = (name: string, fallback: string): string => {
    const resolved = css.getPropertyValue(name).trim();
    return resolved || fallback;
  };
  return {
    bgApp: value("--bg-app", FALLBACK_PALETTE.bgApp),
    bgSurface: value("--bg-surface", FALLBACK_PALETTE.bgSurface),
    bgSurface2: value("--bg-surface-2", FALLBACK_PALETTE.bgSurface2),
    fgPrimary: value("--fg", FALLBACK_PALETTE.fgPrimary),
    fgMuted: value("--fg-muted", FALLBACK_PALETTE.fgMuted),
    fgSubtle: value("--fg-subtle", FALLBACK_PALETTE.fgSubtle),
    border: value("--border", FALLBACK_PALETTE.border),
    borderStrong: value("--border-strong", FALLBACK_PALETTE.borderStrong),
    accent: value("--accent", FALLBACK_PALETTE.accent),
    accentBg: value("--accent-bg", FALLBACK_PALETTE.accentBg),
    info: value("--info", FALLBACK_PALETTE.info),
    warning: value("--warning", FALLBACK_PALETTE.warning),
    warningBg: value("--warning-bg", FALLBACK_PALETTE.warningBg),
    success: value("--success", FALLBACK_PALETTE.success),
    danger: value("--danger", FALLBACK_PALETTE.danger),
    fontSans: value("--font-sans", FALLBACK_PALETTE.fontSans),
    fontMono: value("--font-mono", FALLBACK_PALETTE.fontMono),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterize the Gantt chart"));
    image.src = src;
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function rasterize(svg: string, scale = 2): Promise<HTMLCanvasElement> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Export the Gantt chart as a PNG file download. */
export async function exportGanttAsPng(options: {
  report: GanttReport;
  locale: Locale;
  filename?: string;
  rangeStart?: Date;
  rangeEnd?: Date;
  workingDays?: WorkingDayConfig;
}): Promise<void> {
  const svg = buildGanttExportSvg({
    report: options.report,
    locale: options.locale,
    palette: resolveExportPalette(),
    ...(options.rangeStart && options.rangeEnd
      ? { rangeStart: options.rangeStart, rangeEnd: options.rangeEnd }
      : {}),
    ...(options.workingDays ? { workingDays: options.workingDays } : {}),
  });
  const canvas = await rasterize(svg);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("PNG encoding failed"))), "image/png");
  });
  triggerDownload(blob, options.filename ?? "gantt.png");
}

/** Export the Gantt chart as a single-page PDF file download. */
export async function exportGanttAsPdf(options: {
  report: GanttReport;
  locale: Locale;
  filename?: string;
  rangeStart?: Date;
  rangeEnd?: Date;
  workingDays?: WorkingDayConfig;
}): Promise<void> {
  const svg = buildGanttExportSvg({
    report: options.report,
    locale: options.locale,
    palette: resolveExportPalette(),
    ...(options.rangeStart && options.rangeEnd
      ? { rangeStart: options.rangeStart, rangeEnd: options.rangeEnd }
      : {}),
    ...(options.workingDays ? { workingDays: options.workingDays } : {}),
  });
  const canvas = await rasterize(svg);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const jpegBytes = base64ToBytes(jpegDataUrl.split(",")[1] ?? "");
  const pdf = buildJpegPdf({ widthPx: canvas.width, heightPx: canvas.height, jpegBytes });
  // The buffer is exactly sized (created with `new Uint8Array(size)`), so
  // passing it directly is safe.
  const blob = new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
  triggerDownload(blob, options.filename ?? "gantt.pdf");
}

export { buildJpegPdf };
