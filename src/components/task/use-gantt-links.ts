import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { linkErrorKey } from "./gantt-link-arrows";
import type { GanttLink, GanttRow } from "@/lib/gantt-types";
import type { LinkType } from "./gantt-link-dialog";

export type DepEdit = { type: LinkType; lag: number; lagUnit: "DAY" | "HOUR" };
type LinkErrorKey = import("./gantt-link-arrows").LinkErrorKey;

const DEP_TYPES = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"] as const;

type UseGanttLinksParams = {
  projectId: string;
  onReload?: (() => void) | undefined;
};

export function useGanttLinks({ projectId, onReload }: UseGanttLinksParams) {
  // Link mode
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<LinkErrorKey | null>(null);
  const [pendingLink, setPendingLink] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("FINISH_TO_START");
  const [linkLag, setLinkLag] = useState(0);
  const [linkLagUnit, setLinkLagUnit] = useState<"DAY" | "HOUR">("DAY");

  // Deps panel editing
  const [depsBusy, setDepsBusy] = useState(false);
  const [depEdits, setDepEdits] = useState<Record<string, DepEdit>>({});

  const toggleLinkMode = useCallback(() => {
    setLinkMode((a) => !a);
    setLinkSourceId(null);
    setLinkError(null);
  }, []);

  const startLink = useCallback(
    (row: GanttRow) => {
      if (linkBusy || pendingLink || row.isSummary || row.isMilestone) return;
      if (!linkSourceId) { setLinkSourceId(row.id); setLinkError(null); return; }
      if (linkSourceId === row.id) { setLinkSourceId(null); return; }
      setLinkType("FINISH_TO_START");
      setLinkLag(0);
      setLinkLagUnit("DAY");
      setPendingLink({ sourceId: linkSourceId, targetId: row.id });
      setLinkError(null);
    },
    [linkBusy, pendingLink, linkSourceId],
  );

  const cancelLink = useCallback(() => {
    setPendingLink(null);
    setLinkSourceId(null);
    setLinkError(null);
  }, []);

  const createLink = useCallback(
    async (dependsOnId: string, taskId: string, type: LinkType, lag: number, lagUnit: "DAY" | "HOUR") => {
      setLinkBusy(true);
      setLinkError(null);
      try {
        const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependsOnId, type, lag, lagUnit }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
          setLinkError(linkErrorKey(json?.error?.code));
          return;
        }
        setPendingLink(null);
        setLinkSourceId(null);
        onReload?.();
      } catch {
        setLinkError("loadError");
      } finally {
        setLinkBusy(false);
      }
    },
    [projectId, onReload],
  );

  const removeLink = useCallback(
    async (link: GanttLink) => {
      if (linkBusy) return;
      setLinkBusy(true);
      setLinkError(null);
      try {
        const res = await apiFetch(
          `/api/v1/projects/${projectId}/tasks/${link.target}/dependencies/${link.source}?type=${link.type}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
          setLinkError(linkErrorKey(json?.error?.code));
          return;
        }
        onReload?.();
      } catch {
        setLinkError("loadError");
      } finally {
        setLinkBusy(false);
      }
    },
    [projectId, linkBusy, onReload],
  );

  const beginDepEdit = useCallback((link: GanttLink) => {
    setDepEdits((prev) => ({
      ...prev,
      [link.id]: {
        type: DEP_TYPES.includes(link.type as LinkType) ? (link.type as LinkType) : "FINISH_TO_START",
        lag: link.lag,
        lagUnit: link.lagUnit === "HOUR" ? "HOUR" : "DAY",
      },
    }));
  }, []);

  const saveDepEdit = useCallback(
    async (link: GanttLink) => {
      const edit = depEdits[link.id];
      if (!edit || depsBusy) return;
      setDepsBusy(true);
      setLinkError(null);
      try {
        const del = await apiFetch(
          `/api/v1/projects/${projectId}/tasks/${link.target}/dependencies/${link.source}?type=${link.type}`,
          { method: "DELETE" },
        );
        if (!del.ok) {
          const json = (await del.json().catch(() => null)) as { error?: { code?: string } } | null;
          setLinkError(linkErrorKey(json?.error?.code));
          return;
        }
        const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${link.target}/dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependsOnId: link.source, type: edit.type, lag: edit.lag, lagUnit: edit.lagUnit }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
          setLinkError(linkErrorKey(json?.error?.code));
          return;
        }
        setDepEdits((prev) => { const next = { ...prev }; delete next[link.id]; return next; });
        onReload?.();
      } catch {
        setLinkError("loadError");
      } finally {
        setDepsBusy(false);
      }
    },
    [projectId, depsBusy, depEdits, onReload],
  );

  const onDepEditChange = useCallback((linkId: string, edit: DepEdit) => {
    setDepEdits((prev) => ({ ...prev, [linkId]: edit }));
  }, []);

  const onDepEditCancel = useCallback((linkId: string) => {
    setDepEdits((prev) => { const next = { ...prev }; delete next[linkId]; return next; });
  }, []);

  return {
    linkMode, linkSourceId, linkBusy, linkError, pendingLink,
    linkType, linkLag, linkLagUnit,
    depsBusy, depEdits,
    toggleLinkMode, startLink, cancelLink, createLink, removeLink,
    beginDepEdit, saveDepEdit, onDepEditChange, onDepEditCancel,
    setLinkType, setLinkLag, setLinkLagUnit, setLinkError,
  };
}
