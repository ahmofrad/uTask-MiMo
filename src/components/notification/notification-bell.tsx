"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type Notification = {
  id: string;
  title: string;
  body?: string | null;
  read: boolean;
  createdAt: string;
};

type NotificationBellProps = {
  count?: number;
  notifications?: Notification[];
  onMarkRead?: (_id: string) => void;
  className?: string;
};

export function NotificationBell({ count = 0, notifications = [], onMarkRead, className }: NotificationBellProps) {
  const t = useTranslations("notification");
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-fg-muted hover:text-fg rounded-md hover:bg-bg-surface-2"
        aria-label={`${t("title")}${count > 0 ? ` (${count} ${t("unread")})` : ""}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-fg-inverse bg-destructive rounded-full">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-2 w-80 bg-bg-surface border border-border rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-fg-muted text-center">{t("empty")}</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onMarkRead?.(n.id)}
                  className={cn(
                    "w-full text-start px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg-surface-2",
                    !n.read && "bg-accent-bg/50",
                  )}
                >
                  <p className={cn("text-sm", !n.read ? "text-fg font-medium" : "text-fg-muted")}>{n.title}</p>
                  {n.body && <p className="text-xs text-fg-subtle mt-0.5">{n.body}</p>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
