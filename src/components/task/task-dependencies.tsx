"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { linkLagSuffix } from "@/lib/gantt/links";

type DepEdge = {
  id: string;
  taskId: string;
  dependsOnId: string;
  type: "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH" | "RELATES_TO";
  lag: number;
  lagUnit: "DAY" | "HOUR";
  predecessor?: { id: string; title: string; status: string } | null;
  dependent?: { id: string; title: string; status: string } | null;
};

type DepResponse = { outgoing: DepEdge[]; incoming: DepEdge[] };

type Candidate = { id: string; title: string };

const DEP_TYPES = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"] as const;
type LinkType = (typeof DEP_TYPES)[number];
type LagUnit = "DAY" | "HOUR";

type DepEdit = { type: LinkType; lag: number; lagUnit: LagUnit };

export function TaskDependencies({ projectId, taskId }: { projectId: string; taskId: string }) {
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
        const json = await res.json().catch(() => null);
        setError(t(`dependencies.${errorKey(json?.error?.code)}`) ?? t("dependencies.duplicateError"));
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
        const json = await res.json().catch(() => null);
        setError(t(`dependencies.${errorKey(json?.error?.code)}`) ?? t("wbsMoveError"));
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
        const json = await del.json().catch(() => null);
        setError(t(`dependencies.${errorKey(json?.error?.code)}`) ?? t("wbsMoveError"));
        return;
      }
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
        method: "POST",
        body: JSON.stringify({ dependsOnId: edge.dependsOnId, type: edit.type, lag: edit.lag, lagUnit: edit.lagUnit }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(t(`dependencies.${errorKey(json?.error?.code)}`) ?? t("dependencies.duplicateError"));
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

  const typeLabel = (tp: string) => {
    const map: Record<string, string> = {
      FINISH_TO_START: "typeFS",
      START_TO_START: "typeSS",
      FINISH_TO_FINISH: "typeFF",
      RELATES_TO: "typeRelates",
    };
    return t(`dependencies.${map[tp] ?? "typeFS"}`);
  };

  if (loading) {
    return <div className="text-sm text-fg-muted py-4">{t("wbsTotal")}…</div>;
  }

  const outgoing = deps?.outgoing ?? [];
  const incoming = deps?.incoming ?? [];
  const selectClass = "text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary";

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
          {outgoing.length === 0 ? (
            <p className="text-sm text-fg-muted">{t("dependencies.none")}</p>
          ) : (
            <ul className="space-y-1.5">
              {outgoing.map((e) => {
                const edit = edits[e.id];
                return (
                  <li key={e.id} data-testid="dep-row" data-depends-on={e.dependsOnId} className="flex items-center justify-between gap-2 text-sm">
                    {edit ? (
                      <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="truncate text-xs">{e.predecessor?.title ?? e.dependsOnId}</span>
                        <select
                          data-testid="dep-edit-type"
                          value={edit.type}
                          onChange={(ev) => setEdits((prev) => ({ ...prev, [e.id]: { ...edit, type: ev.target.value as LinkType } }))}
                          className={selectClass}
                        >
                          {DEP_TYPES.map((tp) => (
                            <option key={tp} value={tp}>{typeLabel(tp)}</option>
                          ))}
                        </select>
                        <input
                          data-testid="dep-edit-lag"
                          type="number"
                          value={edit.lag}
                          onChange={(ev) => setEdits((prev) => ({ ...prev, [e.id]: { ...edit, lag: Number(ev.target.value) } }))}
                          className="w-16 text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
                        />
                        <select
                          data-testid="dep-edit-lag-unit"
                          value={edit.lagUnit}
                          onChange={(ev) => setEdits((prev) => ({ ...prev, [e.id]: { ...edit, lagUnit: ev.target.value as LagUnit } }))}
                          className={selectClass}
                        >
                          <option value="DAY">{t("dependencies.lagUnitDay")}</option>
                          <option value="HOUR">{t("dependencies.lagUnitHour")}</option>
                        </select>
                        <button
                          data-testid="dep-edit-save"
                          onClick={() => void saveEdit(e)}
                          disabled={busy}
                          className="px-2 py-1 rounded bg-accent text-fg-inverse text-xs font-medium hover:opacity-90 disabled:opacity-40"
                        >
                          {t("ganttDepsSave")}
                        </button>
                        <button
                          data-testid="dep-edit-cancel"
                          onClick={() =>
                            setEdits((prev) => {
                              const next = { ...prev };
                              delete next[e.id];
                              return next;
                            })
                          }
                          className="px-2 py-1 rounded border border-border-primary text-xs text-fg-secondary hover:bg-bg-surface"
                        >
                          {t("ganttLinkCancel")}
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{e.predecessor?.title ?? e.dependsOnId}</span>
                        <span className="text-xs text-fg-muted shrink-0">
                          {typeLabel(e.type)}<span className="font-mono">{linkLagSuffix(e)}</span>
                        </span>
                        <button
                          data-testid="dep-edit"
                          onClick={() =>
                            setEdits((prev) => ({
                              ...prev,
                              [e.id]: { type: e.type, lag: e.lag, lagUnit: e.lagUnit === "HOUR" ? "HOUR" : "DAY" },
                            }))
                          }
                          className="text-xs text-fg-muted hover:text-accent shrink-0"
                        >
                          {t("ganttDepsEdit")}
                        </button>
                        <button
                          data-testid="dep-remove"
                          onClick={() => removeDep(e.dependsOnId, e.type)}
                          disabled={busy}
                          className="text-xs text-fg-muted hover:text-destructive shrink-0 disabled:opacity-40"
                          title={t("dependencies.remove")}
                        >
                          {t("dependencies.remove")}
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Blocks */}
        <div>
          <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">{t("dependencies.blocks")}</h4>
          {incoming.length === 0 ? (
            <p className="text-sm text-fg-muted">{t("dependencies.none")}</p>
          ) : (
            <ul className="space-y-1">
              {incoming.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="truncate">{e.dependent?.title ?? e.taskId}</span>
                  <span className="text-xs text-fg-muted shrink-0">
                    {typeLabel(e.type)}<span className="font-mono">{linkLagSuffix(e)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Add */}
      <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border-secondary">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-fg-muted mb-1">{t("dependencies.dependsOn")}</label>
          <select
            data-testid="dep-add-select"
            value={selected}
            onChange={(ev) => setSelected(ev.target.value)}
            className="w-full text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("dependencies.typeFS")}</label>
          <select
            data-testid="dep-add-type"
            value={type}
            onChange={(ev) => setType(ev.target.value as LinkType)}
            className="text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
          >
            {DEP_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {typeLabel(tp)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("dependencies.lag")}</label>
          <input
            data-testid="dep-add-lag"
            type="number"
            value={lag}
            onChange={(ev) => setLag(Number(ev.target.value))}
            className="w-16 text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("ganttLinkLagUnit")}</label>
          <select
            data-testid="dep-add-lag-unit"
            value={lagUnit}
            onChange={(ev) => setLagUnit(ev.target.value as LagUnit)}
            className="text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
          >
            <option value="DAY">{t("dependencies.lagUnitDay")}</option>
            <option value="HOUR">{t("dependencies.lagUnitHour")}</option>
          </select>
        </div>
        <button
          data-testid="dep-add-submit"
          onClick={addDep}
          disabled={!selected || busy}
          className="px-3 py-1.5 rounded-md bg-accent text-fg-inverse text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {t("dependencies.addTitle")}
        </button>
      </div>
    </div>
  );
}

function errorKey(code?: string): string {
  switch (code) {
    case "SELF":
      return "selfError";
    case "DUPLICATE":
      return "duplicateError";
    case "CROSS_PROJECT":
      return "sameProjectError";
    case "DEPENDENCY_CYCLE":
      return "cycleError";
    case "DEPENDENCY_BLOCKED":
      return "blocked";
    default:
      return "duplicateError";
  }
}
