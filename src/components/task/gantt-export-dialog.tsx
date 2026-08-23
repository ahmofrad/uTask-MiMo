"use client";

import { useTranslations } from "next-intl";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";

export function GanttExportDialog({
  exportFormat,
  exportStart,
  exportEnd,
  exporting,
  onFormatChange,
  onStartChange,
  onEndChange,
  onSubmit,
  onClose,
}: {
  exportFormat: "png" | "pdf";
  exportStart: string;
  exportEnd: string;
  exporting: boolean;
  onFormatChange: (_f: "png" | "pdf") => void;
  onStartChange: (_v: string) => void;
  onEndChange: (_v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("task");
  const tc = useTranslations();

  return (
    <form
      data-testid="gantt-export-dialog"
      role="dialog"
      aria-label={t("ganttExport")}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border-primary bg-bg-secondary/50 p-3 text-sm"
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs text-fg-muted mb-1">{t("ganttExportFormat")}</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-fg-primary">
            <input
              type="radio"
              name="gantt-export-format"
              data-testid="gantt-export-format-png"
              value="png"
              checked={exportFormat === "png"}
              onChange={() => onFormatChange("png")}
              className="accent-accent"
            />
            {t("ganttExportPng")}
          </label>
          <label className="flex items-center gap-1.5 text-fg-primary">
            <input
              type="radio"
              name="gantt-export-format"
              data-testid="gantt-export-format-pdf"
              value="pdf"
              checked={exportFormat === "pdf"}
              onChange={() => onFormatChange("pdf")}
              className="accent-accent"
            />
            {t("ganttExportPdf")}
          </label>
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        {t("ganttExportStart")}
        <JalaliDatePicker value={exportStart} onChange={(v) => v && onStartChange(v)} className="w-40" testId="gantt-export-start" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        {t("ganttExportEnd")}
        <JalaliDatePicker value={exportEnd} onChange={(v) => v && onEndChange(v)} className="w-40" testId="gantt-export-end" />
      </label>
      <div className="flex items-center gap-2 ms-auto">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-md border border-border-primary bg-bg-primary text-fg-secondary text-sm font-medium hover:bg-bg-surface"
        >
          {tc("common.cancel")}
        </button>
        <button
          type="submit"
          data-testid="gantt-export-submit"
          disabled={exporting}
          className="px-3 py-1.5 rounded-md border border-border-primary bg-bg-surface text-fg-primary text-sm font-medium hover:bg-bg-surface-2 disabled:opacity-40"
        >
          {exporting ? tc("common.loading") : t("ganttExportSubmit")}
        </button>
      </div>
    </form>
  );
}