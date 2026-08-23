"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";

type BackupItem = {
  name: string;
  sizeBytes: number;
  createdAt: string;
};

type BackupInventory = {
  destination: string;
  retentionDays: number;
  backups: BackupItem[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function BackupsPage() {
  const t = useTranslations("admin");
  const { dateTime } = useFormattedDate();
  const [running, setRunning] = useState(false);
  const [inventory, setInventory] = useState<BackupInventory | null>(null);

  async function loadInventory() {
    const response = await apiFetch("/api/v1/admin/backups");
    if (!response.ok) return;
    const body = (await response.json()) as { data?: BackupInventory };
    setInventory(body.data ?? null);
  }

  useEffect(() => {
    void loadInventory();
  }, []);

  async function runBackup() {
    setRunning(true);
    try {
      await apiFetch("/api/v1/admin/backups/run", { method: "POST" });
      await loadInventory();
    } finally {
      setRunning(false);
    }
  }

  const backups = inventory?.backups ?? [];
  const latest = backups[0];

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
            <p className="text-sm text-fg-primary">
              {latest ? dateTime(new Date(latest.createdAt)) : t("noBackups")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-1">{t("destination")}</p>
            <p className="text-sm text-fg-primary">{inventory?.destination ?? t("unknown")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-1">{t("retention")}</p>
            <p className="text-sm text-fg-primary">{t("days", { count: inventory?.retentionDays ?? 30 })}</p>
          </div>
        </div>
      </div>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-4">{t("recentBackups")}</h2>
        {backups.length === 0 ? (
          <div className="text-center py-8 text-sm text-fg-muted">{t("noBackupsRun")}</div>
        ) : (
          <div className="divide-y divide-border-primary">
            {backups.map((backup) => (
              <div key={backup.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="font-mono text-xs text-fg-primary truncate">{backup.name}</span>
                <span className="shrink-0 text-xs text-fg-muted">{formatBytes(backup.sizeBytes)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
