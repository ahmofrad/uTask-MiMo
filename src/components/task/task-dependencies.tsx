"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { DepAddForm } from "./dep-add-form";
import { DepIncomingList } from "./dep-incoming";
import { DepOutgoingList } from "./dep-outgoing";
import { dependencyErrorKey, type Candidate, type DepEdit, type DepEdge, type DepResponse, type LagUnit, type LinkType } from "./dep-types";

export const TaskDependencies = memo(function TaskDependencies({ projectId, taskId }: { projectId: string; taskId: string }) {
  const t = useTranslations("task");
  const [deps, setDeps] = useState<DepResponse | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState("");
  const [type, setType] = useState<LinkType>("FINISH_TO_START");
  const [lag, setLag] = useState(0);
  const [lagUnit, setLagUnit] = useState<LagUnit>("DAY");
  const [edits, setEdits] = useState<Record<string, DepEdit>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [depRes, taskRes] = await Promise.all([
        apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`),
        apiFetch(`/api/v1/tasks?projectId=${projectId}&limit=200`),
      ]);
      if (!depRes.ok || !taskRes.ok) {
        setError(t("dependencies.loadError"));
        return;
      }
      const depJson = await depRes.json();
      const taskJson = await taskRes.json();
      setDeps(depJson.data ?? { outgoing: [], incoming: [] });
      const list: Candidate[] = (taskJson.data ?? []).filter((x: Candidate) => x.id !== taskId);
      setCandidates(list);
      if (!selected && list.length) setSelected(list[0]?.id ?? "");
    } catch {
      setError(t("dependencies.loadError"));
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, selected, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const showError = (res: Response, fallback: string) => {
    void res
      .json()
      .catch(() => null)
      .then((json) => {
        const code = (json as { error?: { code?: string } } | null)?.error?.code;
        setError(code ? t(`dependencies.${dependencyErrorKey(code)}`) : fallback);
      });
  };

  const addDep = async () => {
    if (!selected || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
        method: "POST",
        body: JSON.stringify({ dependsOnId: selected, type, lag: Number(lag), lagUnit }),
      });
      if (!res.ok) {
        showError(res, t("dependencies.duplicateError"));
        return;
      }
      await load();
    } catch {
      setError(t("dependencies.loadError"));
    } finally {
      setBusy(false);
    }
  };

  const removeDep = async (dependsOnId: string, depType: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch(
        `/api/v1/projects/${projectId}/tasks/${taskId}/dependencies/${dependsOnId}?type=${depType}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        showError(res, t("wbsMoveError"));
        return;
      }
      await load();
    } catch {
      setError(t("dependencies.loadError"));
    } finally {
      setBusy(false);
    }
  };

  // The API has no dependency PATCH endpoint, so edits are delete + recreate.
  const saveEdit = async (edge: DepEdge) => {
    const edit = edits[edge.id];
    if (!edit || busy) return;
    setError(null);
    setBusy(true);
    try {
      const del = await apiFetch(
        `/api/v1/projects/${projectId}/tasks/${taskId}/dependencies/${edge.dependsOnId}?type=${edge.type}`,
        { method: "DELETE" },
      );
      if (!del.ok) {
        showError(del, t("wbsMoveError"));
        return;
      }
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
        method: "POST",
        body: JSON.stringify({ dependsOnId: edge.dependsOnId, type: edit.type, lag: edit.lag, lagUnit: edit.lagUnit }),
      });
      if (!res.ok) {
        showError(res, t("dependencies.duplicateError"));
        return;
      }
      setEdits((prev) => {
        const next = { ...prev };
        delete next[edge.id];
        return next;
      });
      await load();
    } catch {
      setError(t("dependencies.loadError"));
    } finally {
      setBusy(false);
    }
  };

  const outgoing = deps?.outgoing ?? [];
  const incoming = deps?.incoming ?? [];

  if (loading) {
    return <div className="text-sm text-fg-muted py-4">{t("wbsTotal")}…</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-fg-inverse bg-destructive px-3 py-2 rounded-md" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Depends on */}
        <div>
          <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">{t("dependencies.dependsOn")}</h4>
          <DepOutgoingList
            edges={outgoing}
            edits={edits}
            busy={busy}
            onStartEdit={(e) =>
              setEdits((prev) => ({
                ...prev,
                [e.id]: { type: e.type, lag: e.lag, lagUnit: e.lagUnit === "HOUR" ? "HOUR" : "DAY" },
              }))
            }
            onCancelEdit={(edgeId) =>
              setEdits((prev) => {
                const next = { ...prev };
                delete next[edgeId];
                return next;
              })
            }
            onSaveEdit={(e) => void saveEdit(e)}
            onRemove={(id, tp) => void removeDep(id, tp)}
            onEditChange={(edgeId, patch) =>
              setEdits((prev) => ({ ...prev, [edgeId]: { ...prev[edgeId]!, ...patch } }))
            }
          />
        </div>

        {/* Blocks */}
        <div>
          <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">{t("dependencies.blocks")}</h4>
          <DepIncomingList edges={incoming} />
        </div>
      </div>

      <DepAddForm
        candidates={candidates}
        selected={selected}
        type={type}
        lag={lag}
        lagUnit={lagUnit}
        busy={busy}
        onSelect={setSelected}
        onTypeChange={setType}
        onLagChange={setLag}
        onLagUnitChange={setLagUnit}
        onSubmit={() => void addDep()}
      />
    </div>
  );
});