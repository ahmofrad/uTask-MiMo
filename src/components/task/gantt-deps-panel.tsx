"use client";

import { useTranslations } from "next-intl";
import { linkLagSuffix } from "@/lib/gantt/links";
import type { GanttLink } from "@/lib/gantt-types";

const DEP_TYPES = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"] as const;
type LinkType = (typeof DEP_TYPES)[number];

export type DepEdit = { type: LinkType; lag: number; lagUnit: "DAY" | "HOUR" };

type Props = {
  links: GanttLink[];
  canEdit: boolean;
  depsBusy: boolean;
  linkBusy: boolean;
  depEdits: Record<string, DepEdit>;
  rowTitle: (_id: string | null) => string;
  typeLabel: (_tp: string) => string;
  beginDepEdit: (_link: GanttLink) => void;
  saveDepEdit: (_link: GanttLink) => Promise<void>;
  removeLink: (_link: GanttLink) => Promise<void>;
  onDepEditChange: (_linkId: string, _edit: DepEdit) => void;
  onDepEditCancel: (_linkId: string) => void;
};

export function GanttDepsPanel({
  links,
  canEdit,
  depsBusy,
  linkBusy,
  depEdits,
  rowTitle,
  typeLabel,
  beginDepEdit,
  saveDepEdit,
  removeLink,
  onDepEditChange,
  onDepEditCancel,
}: Props) {
  const t = useTranslations("task");

  return (
    <div data-testid="gantt-deps-panel" className="rounded-lg border border-border-primary p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {t("ganttDeps")} ({links.length})
        </span>
        {depsBusy && <span className="text-xs text-fg-muted">{t("loading")}</span>}
      </div>
      {links.length === 0 ? (
        <p className="text-sm text-fg-muted">{t("dependencies.none")}</p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => {
            const edit = depEdits[link.id];
            return (
              <li
                key={link.id}
                data-testid="gantt-dep-row"
                data-link-id={link.id}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="min-w-0 flex-1 text-xs">
                  <span className="font-medium text-fg-primary">{rowTitle(link.source)}</span>
                  <span className="mx-1.5 text-fg-muted">→</span>
                  <span className="text-fg-secondary">{rowTitle(link.target)}</span>
                </span>
                {canEdit && edit ? (
                  <>
                    <select
                      data-testid="gantt-dep-type"
                      value={edit.type}
                      onChange={(ev) => onDepEditChange(link.id, { ...edit, type: ev.target.value as LinkType })}
                      className="text-xs bg-bg-primary border border-border rounded px-1 py-1 text-fg-primary"
                    >
                      {DEP_TYPES.map((tp) => (
                        <option key={tp} value={tp}>
                          {typeLabel(tp)}
                        </option>
                      ))}
                    </select>
                    <input
                      data-testid="gantt-dep-lag"
                      type="number"
                      value={edit.lag}
                      onChange={(ev) => onDepEditChange(link.id, { ...edit, lag: Number(ev.target.value) })}
                      className="w-16 text-xs bg-bg-primary border border-border rounded px-1 py-1 text-fg-primary"
                    />
                    <select
                      data-testid="gantt-dep-lag-unit"
                      value={edit.lagUnit}
                      onChange={(ev) =>
                        onDepEditChange(link.id, { ...edit, lagUnit: ev.target.value as "DAY" | "HOUR" })
                      }
                      className="text-xs bg-bg-primary border border-border rounded px-1 py-1 text-fg-primary"
                    >
                      <option value="DAY">{t("dependencies.lagUnitDay")}</option>
                      <option value="HOUR">{t("dependencies.lagUnitHour")}</option>
                    </select>
                    <button
                      type="button"
                      data-testid="gantt-dep-save"
                      onClick={() => void saveDepEdit(link)}
                      disabled={depsBusy}
                      className="px-2 py-1 rounded bg-accent text-fg-inverse text-xs font-medium hover:opacity-90 disabled:opacity-40"
                    >
                      {t("ganttDepsSave")}
                    </button>
                    <button
                      type="button"
                      data-testid="gantt-dep-cancel"
                      onClick={() => onDepEditCancel(link.id)}
                      className="px-2 py-1 rounded border border-border-primary text-xs text-fg-secondary hover:bg-bg-surface"
                    >
                      {t("ganttLinkCancel")}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-fg-muted">
                      {typeLabel(link.type)}
                      <span className="font-mono">{linkLagSuffix(link)}</span>
                    </span>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          data-testid="gantt-dep-edit"
                          onClick={() => beginDepEdit(link)}
                          className="text-xs text-fg-muted hover:text-accent"
                        >
                          {t("ganttDepsEdit")}
                        </button>
                        <button
                          type="button"
                          data-testid="gantt-dep-remove"
                          onClick={() => void removeLink(link)}
                          disabled={linkBusy}
                          className="text-xs text-fg-muted hover:text-destructive disabled:opacity-40"
                        >
                          {t("dependencies.remove")}
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}