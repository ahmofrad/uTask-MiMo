"use client";

import { useLocale, useTranslations } from "next-intl";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { formatDateTime } from "@/lib/date/format";
import { estimatedDaysToHours, estimatedHoursToDays } from "@/lib/date/estimated-time";

type Props = {
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  durationDays: number;
  durationHours: number;
  createdAt: string;
  updatedAt: string;
  onStartDateChange: (_value: string | null) => void;
  onDueDateChange: (_value: string | null) => void;
  onEndDateChange: (_value: string | null) => void;
  onDurationChange: (_days: number, _hours: number) => void;
  onEstimatedChange: (_value: number | null) => void;
};

export function TaskDatesCard({
  startDate,
  endDate,
  dueDate,
  estimatedHours,
  durationDays,
  durationHours,
  createdAt,
  updatedAt,
  onStartDateChange,
  onDueDateChange,
  onEndDateChange,
  onDurationChange,
  onEstimatedChange,
}: Props) {
  const t = useTranslations("task");
  const locale = useLocale() as "fa-IR" | "en-US";

  return (
    <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
      <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
        {t("dateAndDuration")}
      </h4>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-fg-muted block mb-1">{t("startDate")}</label>
          <JalaliDatePicker
            value={startDate?.split("T")[0] ?? null}
            onChange={onStartDateChange}
            placeholder={t("selectDate")}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-fg-muted block mb-1">{t("fields.dueDate")}</label>
          <JalaliDatePicker
            value={dueDate?.split("T")[0] ?? null}
            onChange={onDueDateChange}
            placeholder={t("selectDate")}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-fg-muted block mb-1">{t("endDate")}</label>
          <JalaliDatePicker
            value={endDate?.split("T")[0] ?? null}
            onChange={onEndDateChange}
            placeholder={t("selectDate")}
            className="w-full"
          />
        </div>
      </div>
      <div className="border-t border-border-secondary pt-2">
        <label className="text-xs text-fg-muted block mb-1">{t("duration")}</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="number"
              min={0}
              value={durationDays}
              onChange={(e) => {
                const days = Math.max(0, Number(e.target.value) || 0);
                onDurationChange(days, durationHours);
              }}
              className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-fg"
              placeholder="0"
            />
            <span className="text-xs text-fg-subtle block mt-0.5">{t("days")}</span>
          </div>
          <div className="flex-1">
            <input
              type="number"
              min={0}
              max={23}
              value={durationHours}
              onChange={(e) => {
                const hours = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                onDurationChange(durationDays, hours);
              }}
              className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-fg"
              placeholder="0"
            />
            <span className="text-xs text-fg-subtle block mt-0.5">{t("hours")}</span>
          </div>
        </div>
      </div>
      {estimatedHours != null && (
        <div className="border-t border-border-secondary pt-3">
          <h4 className="text-xs text-fg-muted font-medium mb-1">{t("estimated")}</h4>
          <input
            type="number"
            min={0}
            step={0.5}
            value={estimatedHoursToDays(estimatedHours) ?? ""}
            onChange={(e) => {
              const days = e.target.value ? Number(e.target.value) : null;
              const val = estimatedDaysToHours(days) ?? null;
              onEstimatedChange(val);
            }}
            className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
          />
          <span className="text-xs text-fg-subtle block mt-0.5">{t("days")}</span>
        </div>
      )}
      <div className="border-t border-border-secondary pt-3 text-xs text-fg-muted space-y-1">
        <p>
          {t("createdAt")}: {formatDateTime(new Date(createdAt), locale)}
        </p>
        <p>
          {t("updatedAt")}: {formatDateTime(new Date(updatedAt), locale)}
        </p>
      </div>
    </div>
  );
}