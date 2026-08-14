"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

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

export function TaskDependencies({ projectId, taskId }: { projectId: string; taskId: string }) {
  const t = useTranslations("task");
  const [deps, setDeps] = useState<DepResponse | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState("");
  const [type, setType] = useState<(typeof DEP_TYPES)[number]>("FINISH_TO_START");
  const [lag, setLag] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!selected) return;
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
        method: "POST",
        body: JSON.stringify({ dependsOnId: selected, type, lag: Number(lag) }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(t(`dependencies.${errorKey(json?.error?.code)}`) ?? t("dependencies.duplicateError"));
        return;
      }
      await load();
    } catch {
      setError(t("dependencies.loadError"));
    }
  };

  const removeDep = async (dependsOnId: string, depType: string) => {
    setError(null);
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
            <ul className="space-y-1">
              {outgoing.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{e.predecessor?.title ?? e.dependsOnId}</span>
                    <span className="text-xs text-fg-muted shrink-0">{typeLabel(e.type)}{e.lag ? ` +${e.lag}d` : ""}</span>
                  </span>
                  <button
                    onClick={() => removeDep(e.dependsOnId, e.type)}
                    className="text-xs text-fg-muted hover:text-destructive shrink-0"
                    title={t("dependencies.remove")}
                  >
                    {t("dependencies.remove")}
                  </button>
                </li>
              ))}
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
                  <span className="text-xs text-fg-muted shrink-0">{typeLabel(e.type)}</span>
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
            value={type}
            onChange={(ev) => setType(ev.target.value as (typeof DEP_TYPES)[number])}
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
            type="number"
            value={lag}
            onChange={(ev) => setLag(Number(ev.target.value))}
            className="w-16 text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
          />
        </div>
        <button
          onClick={addDep}
          disabled={!selected}
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
