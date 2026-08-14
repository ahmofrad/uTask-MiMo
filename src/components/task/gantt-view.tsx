"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { GanttChart } from "@/components/task/gantt-chart";
import type { GanttReport } from "@/lib/gantt-types";

export function GanttView({ projectId }: { projectId: string }) {
  const t = useTranslations("task");
  const [report, setReport] = useState<GanttReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/v1/projects/${projectId}/reports/gantt?include=criticalPath`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Gantt report request failed: ${response.status}`);
        return response.json();
      })
      .then((j) => {
        if (active) {
          if (j.data) setReport(j.data);
          else setError(t("ganttLoadError"));
        }
      })
      .catch(() => {
        if (active) setError(t("ganttLoadError"));
      });
    return () => {
      active = false;
    };
  }, [projectId, t]);

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!report) return <div className="text-sm text-fg-muted py-8 text-center">{t("wbsTotal")}…</div>;
  return <GanttChart report={report} projectId={projectId} />;
}
