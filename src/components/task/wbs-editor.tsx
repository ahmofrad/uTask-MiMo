"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import type { WbsNode } from "@/lib/tasks";
import { computeWbsStats, filterWbsBySearch } from "@/lib/tasks/wbs-stats";
import { WbsRow, type DropZone } from "@/components/task/wbs-row";
import { WbsToolbar } from "@/components/task/wbs-toolbar";
import { WbsAddRootForm } from "@/components/task/wbs-add-root-form";

const APPEND_LAST = Number.MAX_SAFE_INTEGER;

const ERROR_KEY: Record<string, string> = {
  SELF_PARENT: "wbsMoveErrorSelfParent",
  CYCLE: "wbsMoveErrorCycle",
  MAX_DEPTH: "wbsMoveErrorMaxDepth",
  CROSS_PROJECT: "wbsMoveErrorCrossProject",
  PARENT_DELETED: "wbsMoveErrorParentDeleted",
  PARENT_NOT_FOUND: "wbsMoveErrorParentNotFound",
};

type EditorProps = {
  projectId: string;
  projectName?: string;
  showHeader?: boolean;
};

export const WbsEditor = memo(function WbsEditor({ projectId, projectName, showHeader = true }: EditorProps) {
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

      <WbsToolbar
        search={search}
        onSearch={setSearch}
        onExpandAll={() => setExpanded(new Set(nodes.filter((node) => node.isSummary).map((node) => node.id)))}
        onCollapseAll={() => setExpanded(new Set())}
        onAddRoot={() => { setAddingRoot(true); setRootTitle(""); }}
      />

      {addingRoot && (
        <WbsAddRootForm
          busy={busyId === "root"}
          title={rootTitle}
          onTitle={setRootTitle}
          onSubmit={() => void addRoot()}
          onCancel={() => { setAddingRoot(false); setRootTitle(""); }}
        />
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
});
