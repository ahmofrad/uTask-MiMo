"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";
import { notificationContent } from "@/lib/notifications/content";

type Notification = {
  id: string;
  type: string;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
  payloadJson?: Record<string, unknown> | null;
};

export function NotificationBell() {
  const t = useTranslations("notification");
  const locale = useLocale();
  const router = useRouter();
  const { shortDate } = useFormattedDate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/api/v1/notifications/count")
      .then((r) => r.json())
      .then((j: { data?: { count?: number } }) => setCount(j?.data?.count ?? 0))
      .catch(() => {});
  }, []);

  async function toggle() {
    if (!open) {
      const res = await apiFetch("/api/v1/notifications?limit=10");
      const j = await res.json();
      setNotifications(j.data);
    }
    setOpen(!open);
  }

  async function markRead(id: string) {
    await apiFetch(`/api/v1/notifications/${id}`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setCount((c) => Math.max(0, c - 1));
  }

  function openNotification(n: Notification) {
    void markRead(n.id);
    if (n.taskId) {
      router.push(`/${locale}/tasks/${n.taskId}`);
      setOpen(false);
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative p-2 text-fg-secondary hover:text-fg-primary"
        aria-label={t("title")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -end-1 flex items-center justify-center w-4 h-4 text-xs font-bold text-fg-inverse bg-destructive rounded-full">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-80 bg-bg-primary border border-border-primary rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-border-primary">
            <span className="text-sm font-semibold text-fg-primary">{t("title")}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-fg-tertiary text-center">{t("empty")}</p>
            ) : (
              notifications.map((n) => {
                const content = notificationContent(n.type, n.payloadJson, t);
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNotification(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openNotification(n);
                      }
                    }}
                    className={`p-3 border-b border-border-primary last:border-b-0 cursor-pointer hover:bg-bg-secondary ${
                      !n.readAt ? "bg-accent/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-fg-primary min-w-0">
                        {content.title}
                      </span>
                      {!n.readAt && (
                        <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1" />
                      )}
                    </div>
                    {content.body && (
                      <p className="text-xs text-fg-muted mt-1 line-clamp-2">{content.body}</p>
                    )}
                    <p className="text-xs text-fg-tertiary mt-1">
                      {shortDate(n.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
