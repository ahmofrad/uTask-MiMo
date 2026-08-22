"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";

type SessionView = {
  id: string;
  createdAt: string;
  lastUsedAt: string;
};

export function SessionsSettings() {
  const t = useTranslations("settings");
  const { shortDate } = useFormattedDate();
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/auth/sessions")
      .then((r) => r.json())
      .then((j) => setSessions(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const revoke = useCallback(async (id: string) => {
    setRevoking(id);
    await apiFetch(`/api/v1/auth/sessions/${id}`, { method: "DELETE" }).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setRevoking(null);
  }, []);

  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-fg-muted">{t("sessions")}</span>
      <div className="space-y-3 w-full">
        {loading ? (
          <p className="text-sm text-fg-muted text-center py-8">{t("loading")}</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-fg-muted text-center py-8">{t("noSessions")}</p>
        ) : (
          sessions.map((s, i) => (
            <div key={s.id} className="flex items-center gap-4 p-4 bg-bg-primary border border-border-secondary rounded-lg">
              <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-success" : "bg-fg-subtle"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg-primary">
                    {i === 0 ? t("thisDevice") : t("session")}
                  </span>
                  {i === 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-success-bg text-success">{t("current")}</span>
                  )}
                </div>
                <div className="text-xs text-fg-muted mt-1">
                  {t("lastActive")}: {shortDate(s.lastUsedAt)}
                </div>
              </div>
              {i > 0 && (
                <button
                  onClick={() => revoke(s.id)}
                  disabled={revoking === s.id}
                  className="text-xs text-fg-muted hover:text-destructive transition-colors disabled:opacity-50"
                >
                  {revoking === s.id ? "…" : t("signOut")}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}