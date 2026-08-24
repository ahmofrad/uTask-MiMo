"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkingDayConfig } from "@/hooks/use-working-day-config";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";
import { GanttCriticalPanel } from "./gantt-critical-panel";
import { GanttDepsPanel } from "./gantt-deps-panel";
import { GanttHeader } from "./gantt-header";
import { GanttTaskRow } from "./gantt-task-row";
import { GanttToolbar } from "./gantt-toolbar";
import { GanttExportDialog } from "./gantt-export-dialog";
import { GanttLinkDialog, type LinkType } from "./gantt-link-dialog";
import { GanttLegend } from "./gantt-legend";
import { GanttLinkArrows, GANTT_CONSTANTS, linkErrorKey } from "./gantt-link-arrows";
import { useGanttTimeline, currentMonthRange } from "./use-gantt-timeline";
import type { GanttLink, GanttReport, GanttRow } from "@/lib/gantt-types";
import { linkLagSuffix } from "@/lib/gantt/links";
import { criticalDescendants, criticalPredecessors } from "@/lib/gantt/chain";
import { formatNumber, type Locale } from "@/lib/date/format";
import { exportGanttAsPdf, exportGanttAsPng } from "@/lib/gantt/export-raster";
import { parseDateOnly } from "@/lib/date/day-marker";
import {
  applyDragDelta,
  createDragState,
  dragPatchBody,
  roundedDragDelta,
  type DragMode,
  type DragState,
} from "@/lib/gantt/drag";
import { getTimelineDragRawDeltaDays } from "@/lib/gantt/timeline";

const DEP_TYPES = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"] as const;
const { ROW_HEIGHT } = GANTT_CONSTANTS;
const GANTT_PREFS_KEY = "ganttPrefs:v1";
const ZOOM_OPTIONS = [
  { width: 36, label: "ganttZoomSmall" },
  { width: 52, label: "ganttZoomMedium" },
  { width: 72, label: "ganttZoomLarge" },
] as const;

type LinkErrorKey = import("./gantt-link-arrows").LinkErrorKey;

export function GanttChart({
  report,
  projectId,
  onReload,
}: {
  report: GanttReport;
  projectId: string;
  onReload?: () => void;
}) {
  const t = useTranslations("task");
  const tc = useTranslations();
  const { addToast } = useToast();
  const workingDays = useWorkingDayConfig();
  const dragRef = useRef<DragState | null>(null);

  // Optimistic drag overrides
  const [overrides, setOverrides] = useState<Record<string, { startDate: string | null; dueDate: string | null }>>({});
  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, override] of Object.entries(prev)) {
        const row = report.tasks.find((c) => c.id === id);
        if (!row) continue;
        const rowStart = row.startDate ?? row.summaryStart ?? null;
        const rowEnd = row.dueDate ?? row.summaryEnd ?? null;
        if (override.startDate === rowStart && override.dueDate === rowEnd) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [report]);

  // Link state
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<LinkErrorKey | null>(null);
  const [pendingLink, setPendingLink] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("FINISH_TO_START");
  const [linkLag, setLinkLag] = useState(0);
  const [linkLagUnit, setLinkLagUnit] = useState<"DAY" | "HOUR">("DAY");
  // Panel toggles
  const [depsOpen, setDepsOpen] = useState(false);
  const [criticalListOpen, setCriticalListOpen] = useState(false);
  const [showCritical, setShowCritical] = useState(true);
  // Zoom
  const [dayWidth, setDayWidth] = useState(52);
  // Export
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "pdf">("png");
  const [exportStart, setExportStart] = useState(currentMonthRange().start);
  const [exportEnd, setExportEnd] = useState(currentMonthRange().end);

  // Read preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GANTT_PREFS_KEY);
      if (!stored) return;
      const prefs = JSON.parse(stored) as {
        dayWidth?: number; depsOpen?: boolean; criticalListOpen?: boolean; showCritical?: boolean;
      };
      if (typeof prefs.dayWidth === "number" && ZOOM_OPTIONS.some((z) => z.width === prefs.dayWidth)) setDayWidth(prefs.dayWidth);
      if (typeof prefs.depsOpen === "boolean") setDepsOpen(prefs.depsOpen);
      if (typeof prefs.criticalListOpen === "boolean") setCriticalListOpen(prefs.criticalListOpen);
      if (typeof prefs.showCritical === "boolean") setShowCritical(prefs.showCritical);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(GANTT_PREFS_KEY, JSON.stringify({ dayWidth, depsOpen, criticalListOpen, showCritical })); } catch { /* ignore */ }
  }, [dayWidth, depsOpen, criticalListOpen, showCritical]);

  // Deps panel editing
  const [depsBusy, setDepsBusy] = useState(false);
  const [depEdits, setDepEdits] = useState<Record<string, { type: LinkType; lag: number; lagUnit: "DAY" | "HOUR" }>>({});

  const canEdit = report.canEdit ?? false;
  const rows = report.tasks;

  // --- Timeline geometry via hook ---
  const geo = useGanttTimeline(rows, overrides, workingDays, dayWidth);
  const { rangeStart, dayCount, days, months, todayOffset, direction, dayPos, timelineXForOffset, dateFor, isDelayed, delayedDays } = geo;
  const locale: Locale = direction === "rtl" ? "fa-IR" : "en-US";

  // Row index for SVG arrows
  const rowIndex = new Map<string, number>();
  rows.forEach((r, i) => rowIndex.set(r.id, i));

  // --- Drag handlers ---
  const onPointerDown = (e: React.PointerEvent, r: GanttRow, mode: DragMode = "move") => {
    if (r.isSummary) return;
    const { start, end } = dateFor(r);
    if (!start) return;
    if (mode !== "move") { e.stopPropagation(); e.preventDefault(); }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = createDragState(r.id, mode, e.clientX, start, end ?? start);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaDays = getTimelineDragRawDeltaDays(d.startX, e.clientX, dayWidth, direction);
    const next = applyDragDelta(d, deltaDays, false);
    dragRef.current = next;
    setOverrides((prev) => ({
      ...prev,
      [next.id]: { startDate: next.currentStart.toISOString(), dueDate: next.currentEnd.toISOString() },
    }));
  };
  const finalizeDrag = async (d: DragState) => {
    const deltaDays = roundedDragDelta(d);
    if (deltaDays === 0) return;
    const snapped = applyDragDelta(d, deltaDays, true);
    setOverrides((prev) => ({
      ...prev,
      [snapped.id]: { startDate: snapped.currentStart.toISOString(), dueDate: snapped.currentEnd.toISOString() },
    }));
    const body = dragPatchBody(snapped);
    try {
      const res = await apiFetch(`/api/v1/tasks/${d.id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as { data?: { autoScheduled?: { id: string; startDate: string | null; dueDate: string | null }[] } } | null;
        const autoScheduled = json?.data?.autoScheduled ?? [];
        if (autoScheduled.length > 0) {
          addToast({
            message: t("autoScheduledToast", { count: autoScheduled.length }),
            action: {
              label: tc("common.undo"),
              onClick: async () => {
                await Promise.allSettled(autoScheduled.map((item) =>
                  apiFetch(`/api/v1/tasks/${item.id}`, { method: "PATCH", body: JSON.stringify({ startDate: item.startDate, dueDate: item.dueDate }) }),
                ));
                setOverrides((prev) => { const next = { ...prev }; delete next[d.id]; return next; });
                onReload?.();
              },
            },
          });
        }
      }
    } catch { setOverrides((prev) => { const next = { ...prev }; delete next[d.id]; return next; }); }
  };
  const onPointerUp = () => { const d = dragRef.current; dragRef.current = null; if (d) void finalizeDrag(d); };
  const onLostPointerCapture = () => { const d = dragRef.current; if (!d) return; dragRef.current = null; void finalizeDrag(d); };

  // --- Link handlers ---
  const toggleLinkMode = () => { setLinkMode((a) => !a); setLinkSourceId(null); setLinkError(null); };
  const startLink = (row: GanttRow) => {
    if (linkBusy || pendingLink || row.isSummary || row.isMilestone) return;
    if (!linkSourceId) { setLinkSourceId(row.id); setLinkError(null); return; }
    if (linkSourceId === row.id) { setLinkSourceId(null); return; }
    setLinkType("FINISH_TO_START"); setLinkLag(0); setLinkLagUnit("DAY");
    setPendingLink({ sourceId: linkSourceId, targetId: row.id });
    setLinkError(null);
  };
  const cancelLink = () => { setPendingLink(null); setLinkSourceId(null); setLinkError(null); };
  const createLink = async (dependsOnId: string, taskId: string, type: LinkType, lag: number, lagUnit: "DAY" | "HOUR") => {
    setLinkBusy(true); setLinkError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId, type, lag, lagUnit }),
      });
      if (!res.ok) { const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null; setLinkError(linkErrorKey(json?.error?.code)); return; }
      setPendingLink(null); setLinkSourceId(null);
      onReload?.();
    } catch { setLinkError("loadError"); }
    finally { setLinkBusy(false); }
  };
  const removeLink = async (link: GanttLink) => {
    if (linkBusy) return; setLinkBusy(true); setLinkError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${link.target}/dependencies/${link.source}?type=${link.type}`, { method: "DELETE" });
      if (!res.ok) { const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null; setLinkError(linkErrorKey(json?.error?.code)); return; }
      onReload?.();
    } catch { setLinkError("loadError"); }
    finally { setLinkBusy(false); }
  };
  const beginDepEdit = (link: GanttLink) => {
    setDepEdits((prev) => ({ ...prev, [link.id]: {
      type: DEP_TYPES.includes(link.type as LinkType) ? (link.type as LinkType) : "FINISH_TO_START",
      lag: link.lag, lagUnit: link.lagUnit === "HOUR" ? "HOUR" : "DAY",
    }}));
  };
  const saveDepEdit = async (link: GanttLink) => {
    const edit = depEdits[link.id];
    if (!edit || depsBusy) return; setDepsBusy(true); setLinkError(null);
    try {
      const del = await apiFetch(`/api/v1/projects/${projectId}/tasks/${link.target}/dependencies/${link.source}?type=${link.type}`, { method: "DELETE" });
      if (!del.ok) { const json = (await del.json().catch(() => null)) as { error?: { code?: string } } | null; setLinkError(linkErrorKey(json?.error?.code)); return; }
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${link.target}/dependencies`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId: link.source, type: edit.type, lag: edit.lag, lagUnit: edit.lagUnit }),
      });
      if (!res.ok) { const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null; setLinkError(linkErrorKey(json?.error?.code)); return; }
      setDepEdits((prev) => { const next = { ...prev }; delete next[link.id]; return next; });
      onReload?.();
    } catch { setLinkError("loadError"); }
    finally { setDepsBusy(false); }
  };

  // --- Export ---
  const doExport = async (format: "png" | "pdf") => {
    if (exporting) return; setExporting(format); setLinkError(null);
    try {
      const range = { rangeStart: parseDateOnly(exportStart), rangeEnd: parseDateOnly(exportEnd) };
      if (format === "png") await exportGanttAsPng({ report, locale, ...range, ...(workingDays ? { workingDays } : {}) });
      else await exportGanttAsPdf({ report, locale, ...range, ...(workingDays ? { workingDays } : {}) });
      setExportOpen(false);
    } catch { setLinkError("loadError"); }
    finally { setExporting(null); }
  };
  const toggleExportDialog = () => {
    if (exportOpen) { setExportOpen(false); return; }
    const range = currentMonthRange();
    setExportStart(range.start); setExportEnd(range.end); setExportFormat("png");
    setExportOpen(true);
  };

  // --- Critical path helpers ---
  const rowTitle = (id: string | null): string => id ? (rows.find((r) => r.id === id)?.title ?? id) : "";
  const typeLabel = (tp: string) => {
    const map: Record<string, string> = { FINISH_TO_START: "typeFS", START_TO_START: "typeSS", FINISH_TO_FINISH: "typeFF", RELATES_TO: "typeRelates" };
    return t(`dependencies.${map[tp] ?? "typeFS"}`);
  };

  const hasCritical = rows.some((r) => r.critical === true);
  const criticalRows = rows.filter((r) => r.critical).sort((a, b) => (a.floatDays ?? 0) - (b.floatDays ?? 0) || a.wbsCode.localeCompare(b.wbsCode));
  const criticalIdSet = new Set(criticalRows.map((r) => r.id));

  const floatPhrase = (days: number): string => {
    const abs = Math.round(Math.abs(days) * 10) / 10;
    const formatted = formatNumber(abs, locale, locale === "fa-IR");
    if (abs === 0) return t("ganttFloatNone");
    if (days > 0) return t("ganttFloatSlack", { days: formatted });
    return t("ganttFloatBehind", { days: formatted });
  };
  const barTitle = (row: GanttRow): string => {
    const parts: string[] = [];
    if (isDelayed(row)) parts.push(t("ganttDelayedDays", { count: delayedDays(row) }));
    if (row.critical === true && row.floatDays != null) parts.push(floatPhrase(row.floatDays));
    if (parts.length > 0) parts.join(" · ");
    return row.isSummary || row.isMilestone ? row.title : (parts.length > 0 ? parts.join(" · ") : "");
  };
  const criticalChainInfo = (row: GanttRow): string => {
    if (row.isSummary) {
      const descendants = criticalDescendants(rows, row.id);
      if (descendants.length === 0) return "";
      const shown = descendants.slice(0, 3).map((d) => d.title);
      if (descendants.length > 3) shown.push(t("ganttFloatMore", { count: descendants.length - 3 }));
      return `${t("ganttFloatVia")}: ${shown.join(", ")}`;
    }
    const predecessors = criticalPredecessors(report.links, criticalIdSet, row.id);
    if (predecessors.length === 0) {
      return (row.startDate == null && row.dueDate != null) ? t("ganttFloatDeadlineDriven") : t("ganttFloatChainHead");
    }
    return `${t("ganttFloatDependsOn")}: ${predecessors.map((p) => `${rowTitle(p.source)} · ${typeLabel(p.type)}${linkLagSuffix(p)}`).join(", ")}`;
  };

  // --- Render ---
  if (rows.length === 0) {
    return <div className="text-center py-12 text-fg-muted text-sm">{t("ganttNoTasks")}</div>;
  }

  const noDateTasks = rows.filter((r) => !r.startDate && !r.dueDate && !r.summaryStart && !r.summaryEnd);
  const totalWidth = dayCount * dayWidth;
  const rowsHeight = rows.length * ROW_HEIGHT;

  return (
    <div className="space-y-4">
      <GanttToolbar
        canEdit={canEdit}
        linkMode={linkMode}
        depsOpen={depsOpen}
        depsCount={report.links.length}
        hasCritical={hasCritical}
        showCritical={showCritical}
        criticalListOpen={criticalListOpen}
        criticalCount={criticalRows.length}
        dayWidth={dayWidth}
        exportOpen={exportOpen}
        exporting={exporting !== null}
        linkError={linkError}
        onToggleLinkMode={toggleLinkMode}
        onToggleDeps={() => setDepsOpen((o) => !o)}
        onToggleShowCritical={() => setShowCritical((v) => !v)}
        onToggleCriticalList={() => setCriticalListOpen((o) => !o)}
        onZoomChange={setDayWidth}
        onToggleExport={toggleExportDialog}
      />

      {exportOpen && (
        <GanttExportDialog
          exportFormat={exportFormat}
          exportStart={exportStart}
          exportEnd={exportEnd}
          exporting={exporting !== null}
          onFormatChange={setExportFormat}
          onStartChange={(v) => setExportStart(v)}
          onEndChange={(v) => setExportEnd(v)}
          onSubmit={() => void doExport(exportFormat)}
          onClose={() => setExportOpen(false)}
        />
      )}

      {pendingLink && (
        <GanttLinkDialog
          linkType={linkType}
          linkLag={linkLag}
          linkLagUnit={linkLagUnit}
          linkBusy={linkBusy}
          sourceTitle={rowTitle(linkSourceId)}
          targetTitle={rowTitle(pendingLink.targetId)}
          onTypeChange={setLinkType}
          onLagChange={setLinkLag}
          onLagUnitChange={setLinkLagUnit}
          onCreate={() => void createLink(pendingLink.sourceId, pendingLink.targetId, linkType, linkLag, linkLagUnit)}
          onCancel={cancelLink}
        />
      )}

      {criticalListOpen && hasCritical && (
        <GanttCriticalPanel
          criticalRows={criticalRows}
          dateFor={dateFor}
          criticalChainInfo={criticalChainInfo}
          floatPhrase={floatPhrase}
        />
      )}

      {depsOpen && (
        <GanttDepsPanel
          links={report.links}
          canEdit={canEdit}
          depsBusy={depsBusy}
          linkBusy={linkBusy}
          depEdits={depEdits}
          rowTitle={rowTitle}
          typeLabel={typeLabel}
          beginDepEdit={beginDepEdit}
          saveDepEdit={saveDepEdit}
          removeLink={removeLink}
          onDepEditChange={(linkId, edit) => setDepEdits((prev) => ({ ...prev, [linkId]: edit }))}
          onDepEditCancel={(linkId) => setDepEdits((prev) => { const next = { ...prev }; delete next[linkId]; return next; })}
        />
      )}

      <div data-testid="gantt-scroll-container" className="overflow-x-auto border border-border-primary rounded-lg">
        <div style={{ minWidth: totalWidth + 288 }}>
          <GanttHeader
            days={days}
            months={months}
            dayWidth={dayWidth}
            totalWidth={totalWidth}
            todayOffset={todayOffset}
            timelineXForOffset={timelineXForOffset}
          />

          <div className="relative" style={{ height: rowsHeight }}>
            <GanttLinkArrows
              links={report.links}
              rows={rows}
              rowIndex={rowIndex}
              linkMode={linkMode}
              geo={geo}
              t={t}
              onRemoveLink={removeLink}
            />

            {rows.map((row, i) => (
              <GanttTaskRow
                key={row.id} row={row} index={i}
                days={days} dayWidth={dayWidth} totalWidth={totalWidth}
                rangeStart={rangeStart}
                linkMode={linkMode} linkSourceId={linkSourceId}
                showCritical={showCritical}
                dateFor={dateFor} isDelayed={isDelayed} barTitle={barTitle}
                dayPos={dayPos} timelineXForOffset={timelineXForOffset}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                onPointerUp={onPointerUp} onLostPointerCapture={onLostPointerCapture}
                startLink={startLink}
              />
            ))}
          </div>
        </div>
      </div>

      {noDateTasks.length > 0 && (
        <div className="text-xs text-fg-muted">{noDateTasks.length} {t("ganttNoDates")}</div>
      )}

      <GanttLegend />
    </div>
  );
}
