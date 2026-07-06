"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

export default function BackupsPage() {
  const t = useTranslations("admin");
  const [running, setRunning] = useState(false);

  async function runBackup() {
    setRunning(true);
    try {
      await apiFetch("/api/v1/admin/backups/run", { method: "POST" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">{t("backups")}</h1>
        <button
          onClick={runBackup}
          disabled={running}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {running ? t("running") : t("runBackupNow")}
        </button>
      </div>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-1">{t("lastBackup")}</p>
            <p className="text-sm text-fg-primary">{t("noBackups")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-1">{t("schedule")}</p>
            <p className="text-sm text-fg-primary">{t("dailyAt2am")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-1">{t("retention")}</p>
            <p className="text-sm text-fg-primary">{t("days", { count: 30 })}</p>
          </div>
        </div>
      </div>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-4">{t("recentBackups")}</h2>
        <div className="text-center py-8 text-sm text-fg-muted">
          {t("noBackupsRun")}
        </div>
      </div>
    </div>
  );
}
