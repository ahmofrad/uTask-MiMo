"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

 type QueueDetail = {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

type QueueHealth = {
  workersStarted: boolean;
  workers: number;
  queues: QueueDetail[];
};

export function QueueHealthPanel() {
  const t = useTranslations("admin");
  const [health, setHealth] = useState<QueueHealth | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/v1/admin/queue-health")
      .then(async (response) => {
        if (!response.ok) throw new Error("queue health unavailable");
        return response.json() as Promise<{ data: QueueHealth }>;
      })
      .then((body) => {
        if (!cancelled) setHealth(body.data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-bg-surface border border-border-primary rounded-xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-fg-primary">{t("queueDashboard")}</h2>
        {health && (
          <span className={health.workersStarted ? "text-success text-sm" : "text-warning text-sm"}>
            {health.workersStarted ? t("workerReady") : t("workerNotReady")}
          </span>
        )}
      </div>
      {failed ? (
        <p className="text-sm text-fg-muted">{t("queueUnavailable")}</p>
      ) : !health ? (
        <p className="text-sm text-fg-muted">{t("loading")}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-fg-secondary">{t("workerCount", { count: health.workers })}</p>
          {health.queues.map((queue) => (
            <div key={queue.name} className="flex flex-wrap items-center justify-between gap-3 border-t border-border-primary pt-3">
              <span className="font-medium text-fg-primary">{queue.name}</span>
              <span className="text-xs text-fg-muted tabular-nums">
                {t("queueCounts", { waiting: queue.waiting, active: queue.active, failed: queue.failed })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
