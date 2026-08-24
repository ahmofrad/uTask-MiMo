"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type TaskCandidate = {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
};

type TaskDependencyPickerProps = {
  projectId: string;
  value: string;
  startDate: string;
  onChange: (_dependsOnId: string) => void;
  onStartDateSuggest: (_startDate: string) => void;
};

export function TaskDependencyPicker({
  projectId,
  value,
  startDate: _startDate,
  onChange,
  onStartDateSuggest,
}: TaskDependencyPickerProps) {
  const t = useTranslations("task");
  const [candidates, setCandidates] = useState<TaskCandidate[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/tasks?projectId=${projectId}&limit=200`);
        if (res.ok) {
          const json = (await res.json()) as { data?: TaskCandidate[] };
          if (active) setCandidates(json.data ?? []);
        }
      } catch {
        /* non-fatal: predecessor picker stays empty */
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  function handleChange(newValue: string) {
    onChange(newValue);
    if (!newValue) return;
    const candidate = candidates.find((c) => c.id === newValue);
    const end = candidate?.dueDate ?? candidate?.startDate ?? null;
    if (end) {
      onStartDateSuggest(end);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-fg-secondary mb-1.5">
        {t("dependsOn")}
      </label>
      <select
        data-testid="task-form-depends-on"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
      >
        <option value="">{t("noDependsOn")}</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.title}
          </option>
        ))}
      </select>
    </div>
  );
}
