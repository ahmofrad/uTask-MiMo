"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AssigneeStack } from "@/components/task/assignee-stack";
import { PriorityBadge } from "@/components/task/priority-badge";
import { StatusBadge } from "@/components/task/status-badge";
import { computeWbsStats, filterWbsBySearch } from "@/lib/tasks/wbs-stats";

export type WBSTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  parentTaskId: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
  projectName?: string;
  progress?: number | null;
};

type WBSTreeProps = {
  tasks: WBSTask[];
};

type TreeRowProps = {
  task: WBSTask;
  code: string;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
};

function TreeRow({ task, code, depth, expanded, hasChildren, onToggle }: TreeRowProps) {
  const t = useTranslations("task");
  const assignees = task.assigneeNames.map((displayName, index) => ({
    id: task.assigneeIds[index] ?? `${task.id}-assignee-${index}`,
    displayName,
  }));
  const status = task.status as "open" | "in_progress" | "done" | "cancelled";
  const priority = task.priority as "low" | "med" | "high" | "urgent";
  const progress = Math.max(0, Math.min(100, task.progress ?? 0));

  return (
    <div data-testid="dashboard-wbs-row" data-task-id={task.id} data-depth={depth} className="group border-t border-border transition-colors first:border-t-0 hover:bg-bg-surface-2">
      <div className="grid min-w-[68rem] grid-cols-12 items-center gap-3 px-3 py-2.5 text-sm">
        <div className="sticky start-0 z-10 col-span-4 flex min-w-0 items-center gap-2 bg-bg-surface group-hover:bg-bg-surface-2" style={{ paddingInlineStart: `${depth * 20}px` }}>
          <button
            type="button"
            onClick={onToggle}
            disabled={!hasChildren}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${hasChildren ? "" : "invisible"}`}
            aria-label={expanded ? t("collapse") : t("expand")}
          >
            {hasChildren && (
              <svg className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
          <span className="w-12 shrink-0 font-mono text-xs text-fg-subtle">{code}</span>
          <Link href={`/tasks/${task.id}`} className="min-w-0 truncate font-medium text-fg-primary hover:text-accent">
            {task.title}
          </Link>
          {hasChildren && <span className="shrink-0 rounded-full border border-border bg-bg-surface px-2 py-0.5 text-xs text-fg-muted">{t("wbsGroup")}</span>}
        </div>
        <div className="col-span-2 min-w-0 truncate text-xs text-fg-muted">{task.projectName ?? "—"}</div>
        <div className="col-span-1"><StatusBadge status={status} /></div>
        <div className="col-span-1"><PriorityBadge priority={priority} /></div>
        <div className="col-span-2 min-w-0">
          {assignees.length > 0 ? <AssigneeStack assignees={assignees} /> : <span className="text-xs text-fg-subtle">{t("unassigned")}</span>}
        </div>
        <div className="col-span-2 flex min-w-0 items-center gap-2">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-surface-3" aria-hidden="true">
            <div className="h-full rounded-full bg-success" style={{ width: `${progress}%` }} />
          </div>
          <span className="w-9 shrink-0 text-end text-xs text-fg-muted">{progress}%</span>
        </div>
      </div>
    </div>
  );
}

export function WBSTree({ tasks }: WBSTreeProps) {
  const t = useTranslations("task");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(tasks.filter((task) => tasks.some((child) => child.parentTaskId === task.id)).map((task) => task.id)));
  const [search, setSearch] = useState("");

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const childrenMap = useMemo(() => {
    const map = new Map<string, WBSTask[]>();
    for (const task of tasks) {
      const parentId = task.parentTaskId && taskById.has(task.parentTaskId) ? task.parentTaskId : "";
      const siblings = map.get(parentId) ?? [];
      siblings.push(task);
      map.set(parentId, siblings);
    }
    return map;
  }, [taskById, tasks]);
  const visibleBySearch = useMemo(() => filterWbsBySearch(tasks, search), [tasks, search]);

  const parentIdSet = useMemo(() => new Set(tasks.map((task) => task.parentTaskId).filter(Boolean)), [tasks]);
  const stats = computeWbsStats(tasks, (id) => parentIdSet.has(id));

  const isVisible = (task: WBSTask) => {
    if (visibleBySearch) return visibleBySearch.has(task.id);
    let parentId = task.parentTaskId;
    while (parentId) {
      if (!expanded.has(parentId)) return false;
      parentId = taskById.get(parentId)?.parentTaskId ?? null;
    }
    return true;
  };

  const renderRows = (parentId: string, depth: number, prefix: string): ReactNode[] => {
    const rows: ReactNode[] = [];
    const children = childrenMap.get(parentId) ?? [];
    children.forEach((task, index) => {
      if (!isVisible(task)) return;
      const code = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      const hasChildren = (childrenMap.get(task.id) ?? []).length > 0;
      rows.push(
        <TreeRow
          key={task.id}
          task={task}
          code={code}
          depth={depth}
          expanded={expanded.has(task.id) || Boolean(visibleBySearch)}
          hasChildren={hasChildren}
          onToggle={() => setExpanded((current) => {
            const next = new Set(current);
            if (next.has(task.id)) next.delete(task.id);
            else next.add(task.id);
            return next;
          })}
        />,
      );
      if (hasChildren && (expanded.has(task.id) || Boolean(visibleBySearch))) rows.push(...renderRows(task.id, depth + 1, code));
    });
    return rows;
  };
  const renderedRows = renderRows("", 0, "");

  return (
    <div data-testid="dashboard-wbs" className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-surface p-3 shadow-xs">
        <div className="relative min-w-[16rem] flex-1">
          <svg className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          </svg>
          <input data-testid="dashboard-wbs-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("wbsSearchPlaceholder")} aria-label={t("wbsSearch")} className="w-full rounded-md border border-border bg-bg-surface-2 py-2 ps-9 pe-3 text-sm text-fg-primary outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>
        <button type="button" data-testid="dashboard-wbs-expand-all" onClick={() => setExpanded(new Set(tasks.filter((task) => tasks.some((child) => child.parentTaskId === task.id)).map((task) => task.id)))} className="rounded-md border border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg-surface-2 hover:text-fg-primary">{t("wbsExpandAll")}</button>
        <button type="button" data-testid="dashboard-wbs-collapse-all" onClick={() => setExpanded(new Set())} className="rounded-md border border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg-surface-2 hover:text-fg-primary">{t("wbsCollapseAll")}</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("wbsStatItems"), value: tasks.length },
          { label: t("wbsStatGroups"), value: stats.groupCount },
          { label: t("wbsStatCompleted"), value: `${stats.completedCount}/${stats.leafCount}` },
          { label: t("wbsStatProgress"), value: `${stats.averageProgress}%` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-bg-surface px-4 py-3">
            <div className="text-lg font-semibold text-fg-primary">{stat.value}</div>
            <div className="mt-0.5 text-xs text-fg-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface shadow-xs">
        <div className="min-w-[68rem]">
          <div data-testid="dashboard-wbs-column-header" className="grid grid-cols-12 gap-3 border-b border-border bg-bg-surface-2 px-3 py-2 text-xs font-medium text-fg-muted">
            <span className="sticky start-0 z-20 col-span-4 bg-bg-surface-2">{t("wbsColumnTask")}</span>
            <span className="col-span-2">{t("wbsColumnProject")}</span>
            <span className="col-span-1">{t("wbsColumnStatus")}</span>
            <span className="col-span-1">{t("wbsColumnPriority")}</span>
            <span className="col-span-2">{t("wbsColumnOwner")}</span>
            <span className="col-span-2">{t("wbsColumnProgress")}</span>
          </div>
          {tasks.length > 0 && renderedRows}
          {tasks.length === 0 && <div className="px-4 py-12 text-center text-sm text-fg-muted">{t("wbsNoTasks")}</div>}
          {tasks.length > 0 && renderedRows.length === 0 && <div data-testid="dashboard-wbs-no-results" className="px-4 py-12 text-center text-sm text-fg-muted">{t("wbsNoResults")}</div>}
        </div>
      </div>
    </div>
  );
}