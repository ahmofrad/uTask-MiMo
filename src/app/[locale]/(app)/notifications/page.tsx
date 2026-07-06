"use client";

import { useState, useEffect } from "react";
import { useFormattedDate } from "@/lib/date/useFormattedDate";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const { dateTime } = useFormattedDate();

  useEffect(() => {
    fetch("/api/v1/notifications")
      .then((r) => r.json())
      .then((j) => setNotifications(j.data ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-fg-primary">Notifications</h1>
        <button className="text-sm text-accent hover:underline">Mark all as read</button>
      </div>

      <div className="space-y-1">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
              n.readAt ? "bg-bg-surface" : "bg-accent-bg/30"
            }`}
          >
            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
              n.readAt ? "bg-fg-subtle" : "bg-accent"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-fg-primary">{n.type.replace(/_/g, " ")}</p>
              <p className="text-xs text-fg-muted mt-1">
                {dateTime(n.createdAt)}
              </p>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">No notifications</p>
        )}
      </div>
    </div>
  );
}
