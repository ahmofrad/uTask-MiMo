"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import type { WbsNode } from "@/lib/tasks";
import { computeWbsStats, filterWbsBySearch } from "@/lib/tasks/wbs-stats";
import { AssigneeStack } from "@/components/task/assignee-stack";
import { PriorityBadge } from "@/components/task/priority-badge";
import { StatusBadge } from "@/components/task/status-badge";

const APPEND_LAST = Number.MAX_SAFE_INTEGER;

const ERROR_KEY: Record<string, string> = {
  SELF_PARENT: "wbsMoveErrorSelfParent",
  CYCLE: "wbsMoveErrorCycle",
  MAX_DEPTH: "wbsMoveErrorMaxDepth",
  CROSS_PROJECT: "wbsMoveErrorCrossProject",
  PARENT_DELETED: "wbsMoveErrorParentDeleted",
  PARENT_NOT_FOUND: "wbsMoveErrorParentNotFound",
};

type DropZone = "before" | "after" | "child";

type EditorProps = {
  projectId: string;
  projectName?: string;
  showHeader?: boolean;
};

type RowProps = {
  node: WbsNode;
  busy: boolean;
  dropTarget: { id: string; zone: DropZone } | null;
  addingChildId: string | null;
  newChildTitle: string;
  onToggle: (_id: string) => void;
  onIndent: (_node: WbsNode) => void;
  onOutdent: (_node: WbsNode) => void;
  onBeginAddChild: (_parentId: string) => void;
  onAddChild: (_parentId: string, _title: string) => void;
  onCancelAddChild: () => void;
  onChildTitle: (_v: string) => void;
  onDragOver: (_node: WbsNode, _e: React.DragEvent) => void;
  onDrop: (_node: WbsNode, _e: React.DragEvent) => void;
  onDragEnd: () => void;
  onProgressChange: (_id: string, _value: number) => void;
  onProgressCommit: (_id: string, _value: number) => void;
  progressBusy: boolean;
  expanded: boolean;
};

function WbsRow(props: RowProps) {
  const t = useTranslations("task");
  const {
    node, busy, dropTarget, addingChildId, newChildTitle,
    onToggle, onIndent, onOutdent, onBeginAddChild, onAddChild, onCancelAddChild, onChildTitle,
    onDragOver, onDrop, onDragEnd, onProgressChange, onProgressCommit, progressBusy, expanded,
  } = props;

  const pct = node.isSummary ? node.rollupPercent : node.progress;
  const isDrop = dropTarget?.id === node.id;
  const dropClass = isDrop
    ? dropTarget?.zone === "before"
      ? "border-t-2 border-accent"
      : dropTarget?.zone === "after"
        ? "border-b-2 border-accent"
        : "bg-accent-bg"
    : "";
  const assignees = node.assigneeNames.map((displayName, index) => ({
    id: node.assigneeIds[index] ?? `${node.id}-assignee-${index}`,
    displayName,
  }));
  const status = node.status as "open" | "in_progress" | "done" | "cancelled";
  const priority = node.priority as "low" | "med" | "high" | "urgent";

  return (
    <div
      data-testid="wbs-row"
      data-task-id={node.id}
      data-depth={node.depth}
      className={`group border-t border-border transition-colors first:border-t-0 hover:bg-bg-surface-2 ${dropClass}`}
      onDragOver={(e) => onDragOver(node, e)}
      onDrop={(e) => onDrop(node, e)}
    >
      <div className="grid min-w-[60rem] grid-cols-12 items-center gap-3 px-3 py-2.5 text-sm">
        <div
          className="sticky start-0 z-10 col-span-5 flex min-w-0 items-center gap-2 bg-bg-surface group-hover:bg-bg-surface-2"
          style={{ paddingInlineStart: `${node.depth * 20}px` }}
        >
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", node.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={onDragEnd}
            className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-fg-subtle hover:bg-bg-primary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
            title={t("dragLabel")}
            aria-label={t("dragLabel")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              node.isSummary ? "cursor-pointer" : "invisible"
            }`}
            aria-label={expanded ? t("collapse") : t("expand")}
            disabled={!node.isSummary}
          >
            {node.isSummary && (
              <svg
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>

          <span data-testid="wbs-code" className="w-12 shrink-0 font-mono text-xs text-fg-subtle">{node.wbsCode}</span>
          <Link
            href={`/tasks/${node.id}`}
            className="min-w-0 truncate font-medium text-fg-primary hover:text-accent"
          >
            {node.title}
          </Link>
          {node.isSummary && (
            <span className="shrink-0 rounded-full border border-border bg-bg-surface px-2 py-0.5 text-xs text-fg-muted" title={t("wbsSummary")}>
              {node.childCount}
            </span>
          )}
        </div>

        <div className="col-span-1">
          <StatusBadge status={status} />
        </div>
        <div className="col-span-1">
          <PriorityBadge priority={priority} />
        </div>
        <div className="col-span-2 min-w-0">
          {assignees.length > 0 ? (
            <AssigneeStack assignees={assignees} />
          ) : (
            <span className="text-xs text-fg-subtle">{t("unassigned")}</span>
          )}
        </div>

        <div className="col-span-2 flex min-w-0 items-center gap-2">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-surface-3" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-[width] ${node.isSummary ? "bg-accent" : "bg-success"}`}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
          {!node.isSummary ? (
            <input
              data-testid="wbs-progress"
              type="range"
              min={0}
              max={100}
              value={node.progress}
              disabled={busy || progressBusy}
              onChange={(e) => onProgressChange(node.id, Number(e.target.value))}
              onPointerUp={(e) => onProgressCommit(node.id, Number((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                  onProgressCommit(node.id, Number((e.target as HTMLInputElement).value));
                }
              }}
              className="w-16 accent-accent"
              aria-label={t("wbsProgress")}
            />
          ) : (
            <span className="w-9 shrink-0 text-end text-xs text-fg-muted">{pct}%</span>
          )}
        </div>

        <div data-testid="wbs-row-actions" className="col-span-1 flex items-center justify-end gap-1">
          <button
            type="button"
            data-testid="wbs-indent"
            onClick={() => onIndent(node)}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={t("wbsIndent")}
            aria-label={t("wbsIndent")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-6-6 6-6m8 0v12" />
            </svg>
          </button>
          <button
            type="button"
            data-testid="wbs-outdent"
            onClick={() => onOutdent(node)}
            disabled={busy || !node.parentTaskId}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={t("wbsOutdent")}
            aria-label={t("wbsOutdent")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l6-6-6-6m-8 0v12" />
            </svg>
          </button>
          <button
            type="button"
            data-testid="wbs-add-child"
            onClick={() => onBeginAddChild(node.id)}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={t("wbsAddChild")}
            aria-label={t("wbsAddChild")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {addingChildId === node.id && (
        <form
          className="flex min-w-[60rem] items-center gap-2 border-t border-border bg-bg-surface-2 px-3 py-2"
          style={{ paddingInlineStart: `${(node.depth + 1) * 20 + 12}px` }}
          onSubmit={(e) => {
            e.preventDefault();
            onAddChild(node.id, newChildTitle);
          }}
        >
          <input
            autoFocus
            value={newChildTitle}
            onChange={(e) => onChildTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancelAddChild();
            }}
            placeholder={t("wbsAddChildPlaceholder")}
            className="min-w-0 flex-1 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-fg-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button type="submit" disabled={busy || !newChildTitle.trim()} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50">
            {t("add")}
          </button>
          <button type="button" onClick={onCancelAddChild} className="rounded-md px-3 py-2 text-sm text-fg-muted hover:bg-bg-primary">
            {t("wbsCancel")}
          </button>
        </form>
      )}
    </div>
  );
}

export function WbsEditor({ projectId, projectName, showHeader = true }: EditorProps) {
  const t = useTranslations("task");
  const [nodes, setNodes] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progressSavingId, setProgressSavingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: DropZone } | null>(null);
  const [addingChildId, setAddingChildId] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [addingRoot, setAddingRoot] = useState(false);
  const [rootTitle, setRootTitle] = useState("");
  const [search, setSearch] = useState("");
  const progressSavingRef = useRef(new Set<string>());
  const progressDebounceRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/wbs`);
      if (!res.ok) throw new Error("WBS request failed");
      const json = await res.json() as { data?: WbsNode[] };
      const data = json.data ?? [];
      setNodes(data);
      setExpanded((prev) => (prev.size > 0 ? prev : new Set(data.filter((n) => n.isSummary).map((n) => n.id))));
    } catch {
      setError(t("wbsMoveError"));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    for (const timeout of progressDebounceRef.current.values()) clearTimeout(timeout);
    progressDebounceRef.current.clear();
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const visibleBySearch = useMemo(() => filterWbsBySearch(nodes, search), [nodes, search]);

  const siblingIndex = (target: WbsNode) => {
    const sibs = nodes.filter((n) => n.parentTaskId === target.parentTaskId);
    return sibs.findIndex((n) => n.id === target.id);
  };

  const doMove = useCallback(
    async (id: string, newParentId: string | null, position: number) => {
      setBusyId(id);
      setError(null);
      try {
        const res = await apiFetch(`/api/v1/tasks/${id}/move`, {
          method: "POST",
          body: JSON.stringify({ newParentId, position }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          const code = json?.error?.code;
          setError(t(ERROR_KEY[code] ?? "wbsMoveError"));
          return;
        }
        await load();
      } catch {
        setError(t("wbsMoveError"));
      } finally {
        setBusyId(null);
        setDropTarget(null);
      }
    },
    [load, t],
  );

  const indent = (target: WbsNode) => {
    const sibs = nodes.filter((n) => n.parentTaskId === target.parentTaskId);
    const pos = sibs.findIndex((n) => n.id === target.id);
    if (pos <= 0) return;
    const prev = sibs[pos - 1];
    if (!prev) return;
    void doMove(target.id, prev.id, APPEND_LAST);
  };

  const outdent = (target: WbsNode) => {
    if (!target.parentTaskId) return;
    const parent = nodeById.get(target.parentTaskId);
    if (!parent) return;
    const sibs = nodes.filter((n) => n.parentTaskId === parent.parentTaskId);
    const pos = sibs.findIndex((n) => n.id === parent.id);
    void doMove(target.id, parent.parentTaskId, pos + 1);
  };

  const beginAddChild = (parentId: string) => {
    setAddingChildId(parentId);
    setNewChildTitle("");
  };

  const addChild = async (parentId: string, title: string) => {
    if (!title.trim()) return;
    setBusyId(parentId);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), projectId, parentTaskId: parentId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const code = json?.error?.code;
        setError(t(ERROR_KEY[code] ?? "wbsCreateError"));
        return;
      }
      setAddingChildId(null);
      setNewChildTitle("");
      await load();
      setExpanded((prev) => new Set(prev).add(parentId));
    } catch {
      setError(t("wbsCreateError"));
    } finally {
      setBusyId(null);
    }
  };

  const addRoot = async () => {
    if (!rootTitle.trim()) return;
    setBusyId("root");
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: rootTitle.trim(), projectId }),
      });
      if (!res.ok) {
        setError(t("wbsCreateError"));
        return;
      }
      setAddingRoot(false);
      setRootTitle("");
      await load();
    } catch {
      setError(t("wbsCreateError"));
    } finally {
      setBusyId(null);
    }
  };

  const onProgressCommit = useCallback(async (id: string, value: number) => {
    const pending = progressDebounceRef.current.get(id);
    if (pending) {
      clearTimeout(pending);
      progressDebounceRef.current.delete(id);
    }
    if (progressSavingRef.current.has(id)) return;
    progressSavingRef.current.add(id);
    setProgressSavingId(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ progress: value }),
      });
      if (!res.ok) throw new Error("Progress update failed");
      await load();
    } catch {
      await load();
      setError(t("wbsProgressSaveError"));
    } finally {
      progressSavingRef.current.delete(id);
      setProgressSavingId(null);
    }
  }, [load, t]);

  const onProgressChange = useCallback((id: string, value: number) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, progress: value } : node)));
    const pending = progressDebounceRef.current.get(id);
    if (pending) clearTimeout(pending);
    progressDebounceRef.current.set(id, setTimeout(() => {
      progressDebounceRef.current.delete(id);
      void onProgressCommit(id, value);
    }, 150));
  }, [onProgressCommit]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDragOver = (node: WbsNode, e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const zone: DropZone = y < rect.height * 0.25 ? "before" : y > rect.height * 0.75 ? "after" : "child";
    setDropTarget({ id: node.id, zone });
  };

  const onDrop = (node: WbsNode, e: React.DragEvent) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData("text/plain");
    if (!dragId || dragId === node.id) return;
    const zone = dropTarget && dropTarget.id === node.id ? dropTarget.zone : "child";
    if (zone === "child") void doMove(dragId, node.id, APPEND_LAST);
    else void doMove(dragId, node.parentTaskId, siblingIndex(node) + (zone === "after" ? 1 : 0));
  };

  const isHidden = (node: WbsNode): boolean => {
    if (visibleBySearch && !visibleBySearch.has(node.id)) return true;
    if (visibleBySearch) return false;

    let pid = node.parentTaskId;
    while (pid) {
      if (!expanded.has(pid)) return true;
      pid = nodeById.get(pid)?.parentTaskId ?? null;
    }
    return false;
  };

  const stats = computeWbsStats(nodes, (id) => nodeById.get(id)?.isSummary === true);
  const visibleNodes = nodes.filter((node) => !isHidden(node));

  if (loading) {
    return <div data-testid="wbs-loading" className="py-10 text-center text-sm text-fg-muted">{t("loading")}</div>;
  }

  return (
    <div data-testid="wbs-editor" className="space-y-5">
      {showHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {projectName && (
              <Link href={`/projects/${projectId}`} className="mb-2 inline-flex text-sm text-fg-muted hover:text-accent">
                {t("backToProject")}
              </Link>
            )}
            <h1 className="text-2xl font-semibold tracking-tight text-fg-primary">{t("wbsTitle")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("wbsDescription")}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      <div data-testid="wbs-toolbar" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-surface p-3 shadow-xs">
        <div className="relative min-w-[16rem] flex-1">
          <svg className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          </svg>
          <input
            data-testid="wbs-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("wbsSearchPlaceholder")}
            aria-label={t("wbsSearch")}
            className="w-full rounded-md border border-border bg-bg-surface-2 py-2 ps-9 pe-3 text-sm text-fg-primary outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <button type="button" data-testid="wbs-expand-all" onClick={() => setExpanded(new Set(nodes.filter((node) => node.isSummary).map((node) => node.id)))} className="rounded-md border border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg-surface-2 hover:text-fg-primary">
          {t("wbsExpandAll")}
        </button>
        <button type="button" data-testid="wbs-collapse-all" onClick={() => setExpanded(new Set())} className="rounded-md border border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg-surface-2 hover:text-fg-primary">
          {t("wbsCollapseAll")}
        </button>
        <button type="button" data-testid="wbs-add-root" onClick={() => { setAddingRoot(true); setRootTitle(""); }} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover">
          + {t("wbsAddRoot")}
        </button>
      </div>

      {addingRoot && (
        <form data-testid="wbs-root-form" className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-bg p-3" onSubmit={(e) => { e.preventDefault(); void addRoot(); }}>
          <input
            data-testid="wbs-root-title"
            autoFocus
            value={rootTitle}
            onChange={(e) => setRootTitle(e.target.value)}
            placeholder={t("wbsAddRootPlaceholder")}
            className="min-w-[16rem] flex-1 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-fg-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button type="submit" disabled={busyId === "root" || !rootTitle.trim()} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50">
            {t("add")}
          </button>
          <button type="button" onClick={() => { setAddingRoot(false); setRootTitle(""); }} className="rounded-md px-3 py-2 text-sm text-fg-muted hover:bg-bg-surface">
            {t("wbsCancel")}
          </button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("wbsStatItems"), value: nodes.length },
          { label: t("wbsStatGroups"), value: nodes.filter((node) => node.isSummary).length },
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
        <div className="min-w-[60rem]">
          <div data-testid="wbs-column-header" className="grid grid-cols-12 gap-3 border-b border-border bg-bg-surface-2 px-3 py-2 text-xs font-medium text-fg-muted">
            <span className="sticky start-0 z-20 col-span-5 bg-bg-surface-2">{t("wbsColumnTask")}</span>
            <span className="col-span-1">{t("wbsColumnStatus")}</span>
            <span className="col-span-1">{t("wbsColumnPriority")}</span>
            <span className="col-span-2">{t("wbsColumnOwner")}</span>
            <span className="col-span-2">{t("wbsColumnProgress")}</span>
            <span className="col-span-1 text-end">{t("wbsColumnActions")}</span>
          </div>
          {visibleNodes.length > 0 ? visibleNodes.map((node) => (
            <WbsRow
              key={node.id}
              node={node}
              busy={busyId === node.id}
              dropTarget={dropTarget}
              addingChildId={addingChildId}
              newChildTitle={newChildTitle}
              onToggle={toggle}
              onIndent={indent}
              onOutdent={outdent}
              onBeginAddChild={beginAddChild}
              onAddChild={addChild}
              onCancelAddChild={() => {
                setAddingChildId(null);
                setNewChildTitle("");
              }}
              onChildTitle={setNewChildTitle}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={() => setDropTarget(null)}
              onProgressChange={onProgressChange}
              onProgressCommit={onProgressCommit}
              progressBusy={progressSavingId === node.id}
              expanded={expanded.has(node.id)}
            />
          )) : (
            <div data-testid="wbs-no-results" className="px-4 py-12 text-center text-sm text-fg-muted">
              {search.trim() ? t("wbsNoResults") : t("wbsEmpty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
