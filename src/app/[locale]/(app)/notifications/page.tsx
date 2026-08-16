"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { notificationContent } from "@/lib/notifications/content";
import { apiFetch } from "@/lib/api-fetch";

type Notification = {
  id: string;
  type: string;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
  payloadJson?: Record<string, unknown> | null;
};

export default function NotificationsPage() {
  const t = useTranslations("notification");
  const locale = useLocale();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const { dateTime } = useFormattedDate();

  function openNotification(n: Notification) {
    if (n.taskId) {
      router.push(`/${locale}/tasks/${n.taskId}`);
    }
  }

  useEffect(() => {
    apiFetch("/api/v1/notifications")
      .then((r) => r.json())
      .then((j) => setNotifications(j.data ?? []))
      .catch(() => {});
  }, []);

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await apiFetch("/api/v1/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>
        <button
          onClick={markAllRead}
          disabled={markingAll}
          className="text-sm text-accent hover:underline disabled:opacity-50"
        >
          {markingAll ? "..." : t("markAllRead")}
        </button>
      </div>

      <div className="space-y-1">
        {notifications.map((n) => {
          const content = notificationContent(n.type, n.payloadJson, t);
          const clickable = !!n.taskId;
          return (
            <div
              key={n.id}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => clickable && openNotification(n)}
              onKeyDown={(e) => {
                if (clickable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  openNotification(n);
                }
              }}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                n.readAt ? "bg-bg-surface" : "bg-accent-bg/30"
              } ${clickable ? "cursor-pointer hover:bg-bg-secondary" : ""}`}
            >
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                n.readAt ? "bg-fg-subtle" : "bg-accent"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg-primary">{content.title}</p>
                {content.body && (
                  <p className="text-xs text-fg-muted mt-1">{content.body}</p>
                )}
                <p className="text-xs text-fg-muted mt-1">
                  {dateTime(n.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        {notifications.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
