"use client";

import { useTranslations } from "next-intl";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";

type TaskScheduleFieldsProps = {
  createMode: boolean;
  startDate: string;
  dueDate: string;
  estimatedDays: string;
  suggestedByDependency: boolean;
  onStartDateChange: (_value: string | null) => void;
  onDueDateChange: (_value: string | null) => void;
  onEstimatedDaysChange: (_value: string) => void;
};

export function TaskScheduleFields({
  createMode,
  startDate,
  dueDate,
  estimatedDays,
  suggestedByDependency,
  onStartDateChange,
  onDueDateChange,
  onEstimatedDaysChange,
}: TaskScheduleFieldsProps) {
  const t = useTranslations("task");

  return (
    <div className="grid grid-cols-2 gap-4">
      {createMode && (
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.startDate")}
          </label>
          <JalaliDatePicker
            testId="task-form-start-date"
            value={startDate}
            onChange={onStartDateChange}
          />
          {suggestedByDependency && (
            <span data-testid="task-form-suggested-date" className="text-xs text-accent block mt-1">
              {t("suggestedFromDependency")}
            </span>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-fg-secondary mb-1.5">
          {t("fields.dueDate")}
        </label>
        <JalaliDatePicker
          value={dueDate}
          onChange={onDueDateChange}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-secondary mb-1.5">
          {t("fields.estimatedHours")}
        </label>
        <input
          type="number"
          value={estimatedDays}
          onChange={(e) => onEstimatedDaysChange(e.target.value)}
          min="0"
          step="0.5"
          className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
        />
        <span className="text-xs text-fg-subtle block mt-0.5">{t("days")}</span>
      </div>
    </div>
  );
}
