"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { GanttChart } from "@/components/task/gantt-chart";
import type { GanttReport } from "@/lib/gantt-types";

export function GanttView({ projectId }: { projectId: string }) {
  const t = useTranslations("task");
  const [report, setReport] = useState<GanttReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/v1/projects/${projectId}/reports/gantt?include=criticalPath`);
      if (!response.ok) throw new Error(`Gantt report request failed: ${response.status}`);
      const j = (await response.json()) as { data?: GanttReport };
      setReport(j.data ?? null);
      if (!j.data) setError(t("ganttLoadError"));
      else setError(null);
    } catch {
      setError(t("ganttLoadError"));
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load, version]);

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!report) return <div className="text-sm text-fg-muted py-8 text-center">{t("wbsTotal")}…</div>;
  return (
    <GanttChart
      report={report}
      projectId={projectId}
      onReload={() => setVersion((v) => v + 1)}
    />
  );
}
