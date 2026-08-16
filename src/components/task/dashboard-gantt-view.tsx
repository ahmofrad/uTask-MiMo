"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { GanttChart } from "@/components/task/gantt-chart";
import type { GanttReport } from "@/lib/gantt-types";

type GanttDashboardGroup = {
  projectId: string;
  projectName: string;
};

type GanttBatchResponse = {
  data?: Record<string, GanttReport>;
};

class GanttLoadError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Gantt report request failed");
    this.status = status;
  }
}

const PROJECT_BATCH_SIZE = 200;

export function DashboardGanttView({ groups }: { groups: GanttDashboardGroup[] }) {
  const t = useTranslations("task");
  const [reports, setReports] = useState<Record<string, GanttReport>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const projectIdsKey = groups.map((group) => group.projectId).join(",");
  const projectIds = useMemo(
    () => (projectIdsKey ? projectIdsKey.split(",") : []),
    [projectIdsKey],
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);
    setReports({});

    if (projectIds.length === 0) {
      setLoading(false);
      return () => undefined;
    }

    async function loadReports() {
      try {
        const batches: string[][] = [];
        for (let i = 0; i < projectIds.length; i += PROJECT_BATCH_SIZE) {
          batches.push(projectIds.slice(i, i + PROJECT_BATCH_SIZE));
        }

        const batchReports = await Promise.all(
          batches.map(async (batch) => {
            const query = new URLSearchParams({
              projectIds: batch.join(","),
              include: "criticalPath",
            });
            const response = await apiFetch(`/api/v1/reports/gantt?${query.toString()}`, {
              signal: controller.signal,
            });
            if (!response.ok) throw new GanttLoadError(response.status);
            const body = await response.json() as GanttBatchResponse;
            if (!body.data) throw new GanttLoadError(response.status);
            return body.data;
          }),
        );

        if (active) {
          setReports(Object.assign({}, ...batchReports));
        }
      } catch (loadError) {
        if (!active || (loadError instanceof Error && loadError.name === "AbortError")) return;
        setError(loadError instanceof GanttLoadError && loadError.status === 429
          ? t("ganttRateLimited")
          : t("ganttLoadError"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReports();
    return () => {
      active = false;
      controller.abort();
    };
  }, [projectIds, projectIdsKey, t, version]);

  if (loading) {
    return <div className="text-sm text-fg-muted py-8 text-center">{t("loading")}</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive py-8 text-center">{error}</div>;
  }
  if (groups.length === 0) {
    return <div className="text-sm text-fg-muted py-8 text-center">{t("ganttNoTasks")}</div>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const report = reports[group.projectId];
        return (
          <div key={group.projectId} className="space-y-2">
            <h3 className="text-sm font-medium text-fg-muted">{group.projectName}</h3>
            {report ? (
              <GanttChart
                report={report}
                projectId={group.projectId}
                onReload={() => setVersion((v) => v + 1)}
              />
            ) : (
              <div className="text-sm text-fg-muted py-8 text-center">{t("ganttNoTasks")}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
