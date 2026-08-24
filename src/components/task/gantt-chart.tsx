"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkingDayConfig } from "@/hooks/use-working-day-config";
import { GanttCriticalPanel } from "./gantt-critical-panel";
import { GanttDepsPanel } from "./gantt-deps-panel";
import { GanttHeader } from "./gantt-header";
import { GanttTaskRow } from "./gantt-task-row";
import { GanttToolbar } from "./gantt-toolbar";
import { GanttLinkDialog } from "./gantt-link-dialog";
import { GanttLegend } from "./gantt-legend";
import { GanttLinkArrows, GANTT_CONSTANTS } from "./gantt-link-arrows";
import { useGanttTimeline } from "./use-gantt-timeline";
import { useGanttDrag, type DragOverrides } from "./use-gantt-drag";
import { useGanttLinks } from "./use-gantt-links";
import { useGanttPreferences } from "./use-gantt-preferences";
import type { GanttReport, GanttRow } from "@/lib/gantt-types";
import { linkLagSuffix } from "@/lib/gantt/links";
import { criticalDescendants, criticalPredecessors } from "@/lib/gantt/chain";
import { formatNumber, type Locale } from "@/lib/date/format";

const { ROW_HEIGHT } = GANTT_CONSTANTS;

export function GanttChart({ report, projectId, onReload }: { report: GanttReport; projectId: string; onReload?: () => void }) {
  const t = useTranslations("task");
  const tc = useTranslations();
  const workingDays = useWorkingDayConfig();
  const canEdit = report.canEdit ?? false;
  const rows = report.tasks;

  // ── State owned by the orchestrator ──
  const [overrides, setOverrides] = useState<DragOverrides>({});

  // Prune overrides when report data catches up
  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, override] of Object.entries(prev)) {
        const row = report.tasks.find((c) => c.id === id);
        if (!row) continue;
        const rowStart = row.startDate ?? row.summaryStart ?? null;
        const rowEnd = row.dueDate ?? row.summaryEnd ?? null;
        if (override.startDate === rowStart && override.dueDate === rowEnd) { delete next[id]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [report]);

  // ── Hooks ──
  const prefs = useGanttPreferences();
  const geo = useGanttTimeline(rows, overrides, workingDays, prefs.dayWidth);
  const { rangeStart, dayCount, days, months, todayOffset, direction, dayPos, timelineXForOffset, dateFor, isDelayed, delayedDays } = geo;
  const locale: Locale = direction === "rtl" ? "fa-IR" : "en-US";
  const drag = useGanttDrag({ dayWidth: prefs.dayWidth, direction, dateFor, setOverrides, onReload, t, tc });
  const links = useGanttLinks({ projectId, onReload });

  // ── Derived data ──
  const rowIndex = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r, i) => m.set(r.id, i)); return m; }, [rows]);
  const rowTitle = (id: string | null): string => id ? (rows.find((r) => r.id === id)?.title ?? id) : "";
  const typeLabel = (tp: string) => { const map: Record<string, string> = { FINISH_TO_START: "typeFS", START_TO_START: "typeSS", FINISH_TO_FINISH: "typeFF", RELATES_TO: "typeRelates" }; return t(`dependencies.${map[tp] ?? "typeFS"}`); };
  const hasCritical = rows.some((r) => r.critical === true);
  const criticalRows = rows.filter((r) => r.critical).sort((a, b) => (a.floatDays ?? 0) - (b.floatDays ?? 0) || a.wbsCode.localeCompare(b.wbsCode));
  const criticalIdSet = useMemo(() => new Set(criticalRows.map((r) => r.id)), [criticalRows]);

  const floatPhrase = (days: number): string => {
    const abs = Math.round(Math.abs(days) * 10) / 10;
    const formatted = formatNumber(abs, locale, locale === "fa-IR");
    if (abs === 0) return t("ganttFloatNone");
    return days > 0 ? t("ganttFloatSlack", { days: formatted }) : t("ganttFloatBehind", { days: formatted });
  };
  const barTitle = (row: GanttRow): string => {
    const parts: string[] = [];
    if (isDelayed(row)) parts.push(t("ganttDelayedDays", { count: delayedDays(row) }));
    if (row.critical === true && row.floatDays != null) parts.push(floatPhrase(row.floatDays));
    return row.isSummary || row.isMilestone ? row.title : (parts.length > 0 ? parts.join(" · ") : "");
  };
  const criticalChainInfo = (row: GanttRow): string => {
    if (row.isSummary) {
      const desc = criticalDescendants(rows, row.id);
      if (desc.length === 0) return "";
      const shown = desc.slice(0, 3).map((d) => d.title);
      if (desc.length > 3) shown.push(t("ganttFloatMore", { count: desc.length - 3 }));
      return `${t("ganttFloatVia")}: ${shown.join(", ")}`;
    }
    const preds = criticalPredecessors(report.links, criticalIdSet, row.id);
    if (preds.length === 0) return (row.startDate == null && row.dueDate != null) ? t("ganttFloatDeadlineDriven") : t("ganttFloatChainHead");
    return `${t("ganttFloatDependsOn")}: ${preds.map((p) => `${rowTitle(p.source)} · ${typeLabel(p.type)}${linkLagSuffix(p)}`).join(", ")}`;
  };

  // ── Render ──
  if (rows.length === 0) return <div className="text-center py-12 text-fg-muted text-sm">{t("ganttNoTasks")}</div>;

  const noDateTasks = rows.filter((r) => !r.startDate && !r.dueDate && !r.summaryStart && !r.summaryEnd);
  const totalWidth = dayCount * prefs.dayWidth;

  return (
    <div className="space-y-4">
      <GanttToolbar canEdit={canEdit} linkMode={links.linkMode} depsOpen={prefs.depsOpen} depsCount={report.links.length}
        hasCritical={hasCritical} showCritical={prefs.showCritical} criticalListOpen={prefs.criticalListOpen} criticalCount={criticalRows.length}
        dayWidth={prefs.dayWidth} exportOpen={false} exporting={false} linkError={links.linkError}
        onToggleLinkMode={links.toggleLinkMode} onToggleDeps={() => prefs.setDepsOpen((o) => !o)}
        onToggleShowCritical={() => prefs.setShowCritical((v) => !v)} onToggleCriticalList={() => prefs.setCriticalListOpen((o) => !o)}
        onZoomChange={prefs.setDayWidth} onToggleExport={() => {}} />

      {links.pendingLink && (
        <GanttLinkDialog linkType={links.linkType} linkLag={links.linkLag} linkLagUnit={links.linkLagUnit}
          linkBusy={links.linkBusy} sourceTitle={rowTitle(links.linkSourceId)} targetTitle={rowTitle(links.pendingLink.targetId)}
          onTypeChange={links.setLinkType} onLagChange={links.setLinkLag} onLagUnitChange={links.setLinkLagUnit}
          onCreate={() => void links.createLink(links.pendingLink!.sourceId, links.pendingLink!.targetId, links.linkType, links.linkLag, links.linkLagUnit)}
          onCancel={links.cancelLink} />
      )}

      {prefs.criticalListOpen && hasCritical && (
        <GanttCriticalPanel criticalRows={criticalRows} dateFor={dateFor} criticalChainInfo={criticalChainInfo} floatPhrase={floatPhrase} />
      )}

      {prefs.depsOpen && (
        <GanttDepsPanel links={report.links} canEdit={canEdit} depsBusy={links.depsBusy} linkBusy={links.linkBusy}
          depEdits={links.depEdits} rowTitle={rowTitle} typeLabel={typeLabel}
          beginDepEdit={links.beginDepEdit} saveDepEdit={links.saveDepEdit} removeLink={links.removeLink}
          onDepEditChange={links.onDepEditChange} onDepEditCancel={links.onDepEditCancel} />
      )}

      <div data-testid="gantt-scroll-container" className="overflow-x-auto border border-border-primary rounded-lg">
        <div style={{ minWidth: totalWidth + 288 }}>
          <GanttHeader days={days} months={months} dayWidth={prefs.dayWidth} totalWidth={totalWidth} todayOffset={todayOffset} timelineXForOffset={timelineXForOffset} />
          <div className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
            <GanttLinkArrows links={report.links} rows={rows} rowIndex={rowIndex} linkMode={links.linkMode} geo={geo} t={t} onRemoveLink={links.removeLink} />
            {rows.map((row, i) => (
              <GanttTaskRow key={row.id} row={row} index={i} days={days} dayWidth={prefs.dayWidth} totalWidth={totalWidth}
                rangeStart={rangeStart} linkMode={links.linkMode} linkSourceId={links.linkSourceId} showCritical={prefs.showCritical}
                dateFor={dateFor} isDelayed={isDelayed} barTitle={barTitle} dayPos={dayPos} timelineXForOffset={timelineXForOffset}
                onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp}
                onLostPointerCapture={drag.onLostPointerCapture} startLink={links.startLink} />
            ))}
          </div>
        </div>
      </div>

      {noDateTasks.length > 0 && <div className="text-xs text-fg-muted">{noDateTasks.length} {t("ganttNoDates")}</div>}
      <GanttLegend />
    </div>
  );
}
