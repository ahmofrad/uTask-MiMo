"use client";

import { useState, useEffect, useRef } from "react";

type Notification = {
  id: string;
  type: string;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/v1/notifications/count")
      .then((r) => r.json())
      .then((j) => setCount(j.data.count))
      .catch(() => {});
  }, []);

  async function toggle() {
    if (!open) {
      const res = await fetch("/api/v1/notifications?limit=10");
      const j = await res.json();
      setNotifications(j.data);
    }
    setOpen(!open);
  }

  async function markRead(id: string) {
    await fetch(`/api/v1/notifications/${id}`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setCount((c) => Math.max(0, c - 1));
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
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -end-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-fg-inverse bg-destructive rounded-full">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-80 bg-bg-primary border border-border-primary rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-border-primary">
            <span className="text-sm font-semibold text-fg-primary">Notifications</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-fg-tertiary text-center">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b border-border-primary last:border-b-0 cursor-pointer hover:bg-bg-secondary ${
                    !n.readAt ? "bg-accent/5" : ""
                  }`}
                  onClick={() => markRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-fg-secondary uppercase min-w-0">
                      {n.type.replace(/_/g, " ")}
                    </span>
                    {!n.readAt && (
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-fg-tertiary mt-1">
                    {new Date(n.createdAt).toISOString().slice(0, 10)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
