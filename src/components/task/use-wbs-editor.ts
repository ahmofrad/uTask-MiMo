"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import type { WbsNode } from "@/lib/tasks";
import { filterWbsBySearch } from "@/lib/tasks/wbs-stats";

const APPEND_LAST = Number.MAX_SAFE_INTEGER;

const ERROR_KEY: Record<string, string> = {
  SELF_PARENT: "wbsMoveErrorSelfParent",
  CYCLE: "wbsMoveErrorCycle",
  MAX_DEPTH: "wbsMoveErrorMaxDepth",
  CROSS_PROJECT: "wbsMoveErrorCrossProject",
  PARENT_DELETED: "wbsMoveErrorParentDeleted",
  PARENT_NOT_FOUND: "wbsMoveErrorParentNotFound",
};

export function useWbsEditor(projectId: string) {
  const t = useTranslations("task");
  const [nodes, setNodes] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progressSavingId, setProgressSavingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: "before" | "after" | "child" } | null>(null);
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
      const json = (await res.json()) as { data?: WbsNode[] };
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

  useEffect(
    () => () => {
      for (const timeout of progressDebounceRef.current.values()) clearTimeout(timeout);
      progressDebounceRef.current.clear();
    },
    [],
  );

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

  const indent = useCallback(
    (target: WbsNode) => {
      const sibs = nodes.filter((n) => n.parentTaskId === target.parentTaskId);
      const pos = sibs.findIndex((n) => n.id === target.id);
      if (pos <= 0) return;
      const prev = sibs[pos - 1];
      if (!prev) return;
      void doMove(target.id, prev.id, APPEND_LAST);
    },
    [nodes, doMove],
  );

  const outdent = useCallback(
    (target: WbsNode) => {
      if (!target.parentTaskId) return;
      const parent = nodeById.get(target.parentTaskId);
      if (!parent) return;
      const sibs = nodes.filter((n) => n.parentTaskId === parent.parentTaskId);
      const pos = sibs.findIndex((n) => n.id === parent.id);
      void doMove(target.id, parent.parentTaskId, pos + 1);
    },
    [nodes, nodeById, doMove],
  );

  const beginAddChild = useCallback((parentId: string) => {
    setAddingChildId(parentId);
    setNewChildTitle("");
  }, []);

  const addChild = useCallback(
    async (parentId: string, title: string) => {
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
    },
    [projectId, load, t],
  );

  const addRoot = useCallback(async () => {
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
  }, [projectId, rootTitle, load, t]);

  const onProgressCommit = useCallback(
    async (id: string, value: number) => {
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
    },
    [load, t],
  );

  const onProgressChange = useCallback(
    (id: string, value: number) => {
      setNodes((current) => current.map((node) => (node.id === id ? { ...node, progress: value } : node)));
      const pending = progressDebounceRef.current.get(id);
      if (pending) clearTimeout(pending);
      progressDebounceRef.current.set(
        id,
        setTimeout(() => {
          progressDebounceRef.current.delete(id);
          void onProgressCommit(id, value);
        }, 150),
      );
    },
    [onProgressCommit],
  );

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onDragOver = useCallback(
    (node: WbsNode, e: React.DragEvent) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const zone: "before" | "after" | "child" =
        y < rect.height * 0.25 ? "before" : y > rect.height * 0.75 ? "after" : "child";
      setDropTarget({ id: node.id, zone });
    },
    [],
  );

  const onDrop = useCallback(
    (node: WbsNode, e: React.DragEvent) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData("text/plain");
      if (!dragId || dragId === node.id) return;
      const zone = dropTarget && dropTarget.id === node.id ? dropTarget.zone : "child";
      if (zone === "child") void doMove(dragId, node.id, APPEND_LAST);
      else void doMove(dragId, node.parentTaskId, siblingIndex(node) + (zone === "after" ? 1 : 0));
    },
    [dropTarget, doMove, nodes],
  );

  const isHidden = useCallback(
    (node: WbsNode): boolean => {
      if (visibleBySearch && !visibleBySearch.has(node.id)) return true;
      if (visibleBySearch) return false;

      let pid = node.parentTaskId;
      while (pid) {
        if (!expanded.has(pid)) return true;
        pid = nodeById.get(pid)?.parentTaskId ?? null;
      }
      return false;
    },
    [visibleBySearch, expanded, nodeById],
  );

  return {
    nodes,
    loading,
    expanded,
    error,
    busyId,
    progressSavingId,
    dropTarget,
    addingChildId,
    newChildTitle,
    addingRoot,
    rootTitle,
    search,
    nodeById,
    visibleBySearch,
    setError,
    setSearch,
    setExpanded,
    setAddingChildId,
    setNewChildTitle,
    setRootTitle,
    setAddingRoot,
    setDropTarget,
    siblingIndex,
    doMove,
    indent,
    outdent,
    beginAddChild,
    addChild,
    addRoot,
    onProgressCommit,
    onProgressChange,
    toggle,
    onDragOver,
    onDrop,
    isHidden,
  };
}
