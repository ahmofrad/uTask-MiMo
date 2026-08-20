"use client";

import { useTranslations } from "next-intl";
import {
  decodeRecurrenceRule,
  RECURRENCE_FREQS,
  type RecurrenceRule,
} from "@/lib/tasks/recurrence";

type Props = {
  recurrenceRule: string | null;
  recurrenceParentId?: string | null;
  onRecurrenceChange: (_rule: RecurrenceRule | null) => void;
};

/**
 * Compact recurrence control for the task sidebar. Edits frequency + interval;
 * `anchor`, `count`, and `endDate` are preserved when already set (they remain
 * manageable through the API). Clearing the frequency removes the rule.
 */
export function TaskRecurrenceEditor({ recurrenceRule, recurrenceParentId, onRecurrenceChange }: Props) {
  const t = useTranslations("task");
  const rule = decodeRecurrenceRule(recurrenceRule);
  const freq = rule?.freq ?? "";
  const interval = rule?.interval ?? 1;

  const changeFreq = (next: string) => {
    if (!next) {
      onRecurrenceChange(null);
      return;
    }
    const base: RecurrenceRule = {
      freq: next as RecurrenceRule["freq"],
      interval: 1,
      anchor: rule?.anchor ?? "dueDate",
    };
    if (rule?.count != null) base.count = rule.count;
    if (rule?.endDate) base.endDate = rule.endDate;
    onRecurrenceChange(base);
  };

  const unitKey = freq === "DAILY" ? "days" : freq === "WEEKLY" ? "weeks" : "months";

  return (
    <div className="space-y-2">
      <select
        value={freq}
        onChange={(e) => changeFreq(e.target.value)}
        className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-fg"
      >
        <option value="">{t("recurrence.none")}</option>
        {RECURRENCE_FREQS.map((f) => (
          <option key={f} value={f}>
            {t(`recurrence.${f.toLowerCase()}`)}
          </option>
        ))}
      </select>
      {freq && rule && (
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <span>{t("recurrence.every")}</span>
          <input
            type="number"
            min={1}
            max={366}
            value={interval}
            onChange={(e) =>
              onRecurrenceChange({ ...rule, interval: Math.max(1, Math.min(366, Number(e.target.value) || 1)) })
            }
            className="w-16 text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
          />
          <span>{t(`recurrence.${unitKey}`)}</span>
        </div>
      )}
      {recurrenceParentId && (
        <p className="text-xs text-fg-subtle">{t("recurrence.partOfSeries")}</p>
      )}
    </div>
  );
}
