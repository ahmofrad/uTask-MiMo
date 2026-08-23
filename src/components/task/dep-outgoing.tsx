"use client";

import { useTranslations } from "next-intl";
import { linkLagSuffix } from "@/lib/gantt/links";
import { DEP_TYPES, type DepEdge, type DepEdit, type LagUnit, type LinkType, typeLabelKey } from "./dep-types";

type Props = {
  edges: DepEdge[];
  edits: Record<string, DepEdit>;
  busy: boolean;
  onStartEdit: (_edge: DepEdge) => void;
  onCancelEdit: (_edgeId: string) => void;
  onSaveEdit: (_edge: DepEdge) => void;
  onRemove: (_dependsOnId: string, _type: string) => void;
  onEditChange: (_edgeId: string, _patch: Partial<DepEdit>) => void;
};

export function DepOutgoingList({ edges, edits, busy, onStartEdit, onCancelEdit, onSaveEdit, onRemove, onEditChange }: Props) {
  const t = useTranslations("task");
  const typeLabel = (tp: string) => t(typeLabelKey(tp));
  const selectClass = "text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary";

  if (edges.length === 0) {
    return <p className="text-sm text-fg-muted">{t("dependencies.none")}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {edges.map((e) => {
        const edit = edits[e.id];
        return (
          <li key={e.id} data-testid="dep-row" data-depends-on={e.dependsOnId} className="flex items-center justify-between gap-2 text-sm">
            {edit ? (
              <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="truncate text-xs">{e.predecessor?.title ?? e.dependsOnId}</span>
                <select
                  data-testid="dep-edit-type"
                  value={edit.type}
                  onChange={(ev) => onEditChange(e.id, { type: ev.target.value as LinkType })}
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
                  onChange={(ev) => onEditChange(e.id, { lag: Number(ev.target.value) })}
                  className="w-16 text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
                />
                <select
                  data-testid="dep-edit-lag-unit"
                  value={edit.lagUnit}
                  onChange={(ev) => onEditChange(e.id, { lagUnit: ev.target.value as LagUnit })}
                  className={selectClass}
                >
                  <option value="DAY">{t("dependencies.lagUnitDay")}</option>
                  <option value="HOUR">{t("dependencies.lagUnitHour")}</option>
                </select>
                <button
                  data-testid="dep-edit-save"
                  onClick={() => onSaveEdit(e)}
                  disabled={busy}
                  className="px-2 py-1 rounded bg-accent text-fg-inverse text-xs font-medium hover:opacity-90 disabled:opacity-40"
                >
                  {t("ganttDepsSave")}
                </button>
                <button
                  data-testid="dep-edit-cancel"
                  onClick={() => onCancelEdit(e.id)}
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
                  onClick={() => onStartEdit(e)}
                  className="text-xs text-fg-muted hover:text-accent shrink-0"
                >
                  {t("ganttDepsEdit")}
                </button>
                <button
                  data-testid="dep-remove"
                  onClick={() => onRemove(e.dependsOnId, e.type)}
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
  );
}