"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import type { WbsNode } from "@/lib/tasks";

const APPEND_LAST = Number.MAX_SAFE_INTEGER;

const STATUS_COLOR: Record<string, string> = {
  open: "bg-info",
  in_progress: "bg-warning",
  done: "bg-success",
  cancelled: "bg-fg-subtle",
};

const ERROR_KEY: Record<string, string> = {
  SELF_PARENT: "wbsMoveErrorSelfParent",
  CYCLE: "wbsMoveErrorCycle",
  MAX_DEPTH: "wbsMoveErrorMaxDepth",
  CROSS_PROJECT: "wbsMoveErrorCrossProject",
  PARENT_DELETED: "wbsMoveErrorParentDeleted",
  PARENT_NOT_FOUND: "wbsMoveErrorParentNotFound",
};

type DropZone = "before" | "after" | "child";

type EditorProps = { projectId: string };

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
  onProgress: (_id: string, _value: number) => void;
  expanded: boolean;
};

function WbsRow(props: RowProps) {
  const t = useTranslations("task");
  const {
    node, busy, dropTarget, addingChildId, newChildTitle,
    onToggle, onIndent, onOutdent, onBeginAddChild, onAddChild, onCancelAddChild, onChildTitle,
    onDragOver, onDrop, onDragEnd, onProgress, expanded,
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

  return (
    <div
      data-testid="wbs-row"
      data-task-id={node.id}
      className={`relative flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-bg-secondary transition-colors group ${dropClass}`}
      style={{ paddingInlineStart: `${node.depth * 20 + 8}px` }}
      onDragOver={(e) => onDragOver(node, e)}
      onDrop={(e) => onDrop(node, e)}
    >
      <button
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={onDragEnd}
        className="cursor-grab text-fg-subtle hover:text-fg-primary shrink-0"
        title={t("dragLabel")}
        aria-label={t("dragLabel")}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" />
        </svg>
      </button>

      <button
        onClick={() => onToggle(node.id)}
        className={`w-4 h-4 flex items-center justify-center shrink-0 text-fg-muted hover:text-fg-primary transition-colors ${
          node.isSummary ? "cursor-pointer" : "invisible"
        }`}
        aria-label={expanded ? t("collapse") : t("expand")}
      >
        {node.isSummary && (
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      <span data-testid="wbs-code" className="text-xs font-mono text-fg-subtle w-10 shrink-0">{node.wbsCode}</span>

      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLOR[node.status] || "bg-info"}`} />

      <Link
        href={`/tasks/${node.id}`}
        className="text-sm font-medium text-fg-primary hover:text-accent truncate flex-1"
      >
        {node.title}
      </Link>

      {node.isSummary && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-bg-secondary text-fg-muted shrink-0">
          {node.childCount}
        </span>
      )}

      <div className="flex items-center gap-2 shrink-0 w-32">
        <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${node.isSummary ? "bg-accent" : "bg-success"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {!node.isSummary ? (
          <input
            data-testid="wbs-progress"
            type="range"
            min={0}
            max={100}
            value={node.progress}
            disabled={busy}
            onChange={(e) => onProgress(node.id, Number(e.target.value))}
            onPointerUp={(e) => onProgress(node.id, Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => onProgress(node.id, Number((e.target as HTMLInputElement).value))}
            className="w-12 accent-accent"
            aria-label={t("wbsProgress")}
          />
        ) : (
          <span className="text-xs text-fg-muted w-8 text-end">{pct}%</span>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          data-testid="wbs-indent"
          onClick={() => onIndent(node)}
          disabled={busy}
          className="p-1 rounded hover:bg-bg-primary text-fg-muted hover:text-fg-primary disabled:opacity-40"
          title={t("wbsIndent")}
          aria-label={t("wbsIndent")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-6-6 6-6m8 0v12" />
          </svg>
        </button>
        <button
          data-testid="wbs-outdent"
          onClick={() => onOutdent(node)}
          disabled={busy || !node.parentTaskId}
          className="p-1 rounded hover:bg-bg-primary text-fg-muted hover:text-fg-primary disabled:opacity-40"
          title={t("wbsOutdent")}
          aria-label={t("wbsOutdent")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l6-6-6-6m-8 0v12" />
          </svg>
        </button>
        <button
          data-testid="wbs-add-child"
          onClick={() => onBeginAddChild(node.id)}
          disabled={busy}
          className="p-1 rounded hover:bg-bg-primary text-fg-muted hover:text-fg-primary disabled:opacity-40"
          title={t("wbsAddChild")}
          aria-label={t("wbsAddChild")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {addingChildId === node.id && (
        <div className="absolute inset-x-0 mt-1 z-10 bg-bg-surface border border-border rounded-md p-2 shadow-lg">
          <input
            autoFocus
            value={newChildTitle}
            onChange={(e) => onChildTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAddChild(node.id, newChildTitle);
              if (e.key === "Escape") onCancelAddChild();
            }}
            placeholder={t("wbsAddChildPlaceholder")}
            className="w-full bg-bg-secondary rounded px-2 py-1 text-sm outline-none border border-border"
          />
        </div>
      )}
    </div>
  );
}

export function WbsEditor({ projectId }: EditorProps) {
  const t = useTranslations("task");
  const [nodes, setNodes] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: DropZone } | null>(null);
  const [addingChildId, setAddingChildId] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/wbs`);
      const json = await res.json();
      const data: WbsNode[] = json.data ?? [];
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
    doMove(target.id, prev.id, APPEND_LAST);
  };

  const outdent = (target: WbsNode) => {
    if (!target.parentTaskId) return;
    const parent = nodes.find((n) => n.id === target.parentTaskId);
    if (!parent) return;
    const sibs = nodes.filter((n) => n.parentTaskId === parent.parentTaskId);
    const pos = sibs.findIndex((n) => n.id === parent.id);
    doMove(target.id, parent.parentTaskId, pos + 1);
  };

  const beginAddChild = (parentId: string) => {
    setAddingChildId(parentId);
    setNewChildTitle("");
  };

  const addChild = async (parentId: string, title: string) => {
    if (!title.trim()) return;
    setBusyId(parentId);
    try {
      const res = await apiFetch(`/api/v1/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), projectId, parentTaskId: parentId }),
      });
      if (res.ok) {
        setAddingChildId(null);
        setNewChildTitle("");
        await load();
        setExpanded((prev) => new Set(prev).add(parentId));
      } else {
        const json = await res.json().catch(() => null);
        const code = json?.error?.code;
        setError(t(ERROR_KEY[code] ?? "wbsMoveError"));
      }
    } catch {
      setError(t("wbsMoveError"));
    } finally {
      setBusyId(null);
    }
  };

  const setProgress = async (id: string, value: number) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, progress: value } : n)));
    try {
      await apiFetch(`/api/v1/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ progress: value }),
      });
    } catch {
      void load();
    }
  };

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
    if (zone === "child") doMove(dragId, node.id, APPEND_LAST);
    else doMove(dragId, node.parentTaskId, siblingIndex(node) + (zone === "after" ? 1 : 0));
  };

  const isHidden = (node: WbsNode): boolean => {
    let pid = node.parentTaskId;
    while (pid) {
      if (!expanded.has(pid)) return true;
      pid = nodes.find((n) => n.id === pid)?.parentTaskId ?? null;
    }
    return false;
  };

  if (loading) {
    return <div className="text-sm text-fg-muted py-8 text-center">{t("wbsTotal")}…</div>;
  }

  if (nodes.length === 0) {
    return <div className="text-sm text-fg-muted py-8 text-center">{t("wbsEmpty")}</div>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-fg-inverse bg-destructive px-3 py-2 rounded-md" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-fg-muted px-2">
        <span>{nodes.length} {t("wbsTotal")}</span>
      </div>

      <div className="border border-border-primary rounded-lg overflow-hidden relative">
        {nodes.map((node) => {
          if (isHidden(node)) return null;
          return (
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
              onProgress={setProgress}
              expanded={expanded.has(node.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
