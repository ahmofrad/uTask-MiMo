"use client";

import { useTranslations } from "next-intl";

const DEP_TYPES = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"] as const;
export type LinkType = (typeof DEP_TYPES)[number];

function typeLabel(t: ReturnType<typeof useTranslations<"task">>, tp: string) {
  const map: Record<string, string> = {
    FINISH_TO_START: "typeFS",
    START_TO_START: "typeSS",
    FINISH_TO_FINISH: "typeFF",
    RELATES_TO: "typeRelates",
  };
  return t(`dependencies.${map[tp] ?? "typeFS"}`);
}

export function GanttLinkDialog({
  linkType,
  linkLag,
  linkLagUnit,
  linkBusy,
  sourceTitle,
  targetTitle,
  onTypeChange,
  onLagChange,
  onLagUnitChange,
  onCreate,
  onCancel,
}: {
  linkType: LinkType;
  linkLag: number;
  linkLagUnit: "DAY" | "HOUR";
  linkBusy: boolean;
  sourceTitle: string;
  targetTitle: string;
  onTypeChange: (_tp: LinkType) => void;
  onLagChange: (_lag: number) => void;
  onLagUnitChange: (_u: "DAY" | "HOUR") => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("task");

  return (
    <form
      data-testid="gantt-link-dialog"
      role="dialog"
      aria-label={t("ganttLinkTitle")}
      onSubmit={(e) => {
        e.preventDefault();
        onCreate();
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border-primary bg-bg-secondary/50 p-3 text-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t("ganttLinkTitle")}</div>
        <div className="truncate text-xs text-fg-primary">
          {sourceTitle} <span className="text-fg-muted">→</span> {targetTitle}
        </div>
      </div>
      <label className="text-xs text-fg-muted">
        {t("dependencies.title")}
        <select
          value={linkType}
          onChange={(ev) => onTypeChange(ev.target.value as LinkType)}
          data-testid="gantt-link-type"
          className="mt-1 block w-full text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
        >
          {DEP_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {typeLabel(t, tp)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-fg-muted">
        {t("dependencies.lag")}
        <input
          type="number"
          value={linkLag}
          onChange={(ev) => onLagChange(Number(ev.target.value))}
          data-testid="gantt-link-lag"
          className="mt-1 block w-20 text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
        />
      </label>
      <label className="text-xs text-fg-muted">
        {t("ganttLinkLagUnit")}
        <select
          value={linkLagUnit}
          onChange={(ev) => onLagUnitChange(ev.target.value as "DAY" | "HOUR")}
          data-testid="gantt-link-lag-unit"
          className="mt-1 block w-full text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
        >
          <option value="DAY">{t("dependencies.lagUnitDay")}</option>
          <option value="HOUR">{t("dependencies.lagUnitHour")}</option>
        </select>
      </label>
      <button
        type="submit"
        data-testid="gantt-link-create"
        disabled={linkBusy}
        className="px-3 py-1.5 rounded-md bg-accent text-fg-inverse text-sm font-medium hover:opacity-90 disabled:opacity-40"
      >
        {t("ganttLinkCreate")}
      </button>
      <button
        type="button"
        data-testid="gantt-link-cancel"
        onClick={onCancel}
        className="px-3 py-1.5 rounded-md border border-border-primary bg-bg-primary text-fg-secondary text-sm font-medium hover:bg-bg-surface"
      >
        {t("ganttLinkCancel")}
      </button>
    </form>
  );
}