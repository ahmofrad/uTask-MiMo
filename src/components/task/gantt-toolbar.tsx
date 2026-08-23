"use client";

import { useTranslations } from "next-intl";

const ZOOM_OPTIONS = [
  { width: 36, label: "ganttZoomSmall" },
  { width: 52, label: "ganttZoomMedium" },
  { width: 72, label: "ganttZoomLarge" },
] as const;

const toolbarButton = (active: boolean) =>
  `px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
    active
      ? "border-accent bg-accent text-fg-inverse"
      : "border-border-primary bg-bg-primary text-fg-secondary hover:bg-bg-surface"
  }`;

export function GanttToolbar({
  canEdit,
  linkMode,
  depsOpen,
  depsCount,
  hasCritical,
  showCritical,
  criticalListOpen,
  criticalCount,
  dayWidth,
  exportOpen,
  exporting,
  linkError,
  onToggleLinkMode,
  onToggleDeps,
  onToggleShowCritical,
  onToggleCriticalList,
  onZoomChange,
  onToggleExport,
}: {
  canEdit: boolean;
  linkMode: boolean;
  depsOpen: boolean;
  depsCount: number;
  hasCritical: boolean;
  showCritical: boolean;
  criticalListOpen: boolean;
  criticalCount: number;
  dayWidth: number;
  exportOpen: boolean;
  exporting: boolean;
  linkError: string | null;
  onToggleLinkMode: () => void;
  onToggleDeps: () => void;
  onToggleShowCritical: () => void;
  onToggleCriticalList: () => void;
  onZoomChange: (_width: number) => void;
  onToggleExport: () => void;
}) {
  const t = useTranslations("task");

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {canEdit && (
        <button
          type="button"
          data-testid="gantt-link-toggle"
          onClick={onToggleLinkMode}
          aria-pressed={linkMode}
          className={toolbarButton(linkMode)}
        >
          {t("ganttLinkTasks")}
        </button>
      )}
      <button
        type="button"
        data-testid="gantt-deps-toggle"
        onClick={onToggleDeps}
        aria-pressed={depsOpen}
        aria-expanded={depsOpen}
        className={toolbarButton(depsOpen)}
      >
        {t("ganttDeps")} ({depsCount})
      </button>
      {hasCritical && (
        <button
          type="button"
          data-testid="gantt-critical-toggle"
          onClick={onToggleShowCritical}
          aria-pressed={showCritical}
          className={toolbarButton(showCritical)}
        >
          {t("ganttCriticalPath")}
        </button>
      )}
      {hasCritical && (
        <button
          type="button"
          data-testid="gantt-critical-list"
          onClick={onToggleCriticalList}
          aria-pressed={criticalListOpen}
          aria-expanded={criticalListOpen}
          className={toolbarButton(criticalListOpen)}
        >
          {t("ganttCriticalList")} ({criticalCount})
        </button>
      )}
      <label className="flex items-center gap-1.5 text-xs text-fg-muted">
        {t("ganttZoom")}
        <select
          data-testid="gantt-zoom"
          value={dayWidth}
          onChange={(ev) => onZoomChange(Number(ev.target.value))}
          className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
        >
          {ZOOM_OPTIONS.map((zoom) => (
            <option key={zoom.width} value={zoom.width}>
              {t(zoom.label)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        data-testid="gantt-export"
        onClick={onToggleExport}
        disabled={exporting}
        aria-expanded={exportOpen}
        className={exportOpen ? toolbarButton(true) : "px-3 py-1.5 rounded-md border border-border-primary bg-bg-primary text-fg-secondary text-sm font-medium hover:bg-bg-surface disabled:opacity-40"}
      >
        {t("ganttExport")}
      </button>
      {linkMode && (
        <span className="text-xs text-fg-muted" role="status">
          {t("ganttLinkHint")}
        </span>
      )}
      {linkError && (
        <span className="text-xs text-destructive" role="alert">
          {t(`dependencies.${linkError}`)}
        </span>
      )}
    </div>
  );
}