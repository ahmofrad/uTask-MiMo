"use client";

import { useTranslations } from "next-intl";
import { DEP_TYPES, type Candidate, type LagUnit, type LinkType, typeLabelKey } from "./dep-types";

type Props = {
  candidates: Candidate[];
  selected: string;
  type: LinkType;
  lag: number;
  lagUnit: LagUnit;
  busy: boolean;
  onSelect: (_id: string) => void;
  onTypeChange: (_type: LinkType) => void;
  onLagChange: (_lag: number) => void;
  onLagUnitChange: (_unit: LagUnit) => void;
  onSubmit: () => void;
};

export function DepAddForm({ candidates, selected, type, lag, lagUnit, busy, onSelect, onTypeChange, onLagChange, onLagUnitChange, onSubmit }: Props) {
  const t = useTranslations("task");
  const typeLabel = (tp: string) => t(typeLabelKey(tp));

  return (
    <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border-secondary">
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs text-fg-muted mb-1">{t("dependencies.dependsOn")}</label>
        <select
          data-testid="dep-add-select"
          value={selected}
          onChange={(ev) => onSelect(ev.target.value)}
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
          onChange={(ev) => onTypeChange(ev.target.value as LinkType)}
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
          onChange={(ev) => onLagChange(Number(ev.target.value))}
          className="w-16 text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
        />
      </div>
      <div>
        <label className="block text-xs text-fg-muted mb-1">{t("ganttLinkLagUnit")}</label>
        <select
          data-testid="dep-add-lag-unit"
          value={lagUnit}
          onChange={(ev) => onLagUnitChange(ev.target.value as LagUnit)}
          className="text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
        >
          <option value="DAY">{t("dependencies.lagUnitDay")}</option>
          <option value="HOUR">{t("dependencies.lagUnitHour")}</option>
        </select>
      </div>
      <button
        data-testid="dep-add-submit"
        onClick={onSubmit}
        disabled={!selected || busy}
        className="px-3 py-1.5 rounded-md bg-accent text-fg-inverse text-sm font-medium hover:opacity-90 disabled:opacity-40"
      >
        {t("dependencies.addTitle")}
      </button>
    </div>
  );
}