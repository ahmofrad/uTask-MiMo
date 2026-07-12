"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarView, type CalendarTask } from "@/components/task/calendar-view";
import { apiFetch } from "@/lib/api-fetch";

type TaskDTO = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate?: string | null;
  progress?: number | null;
};

export default function CalendarPage() {
  const t = useTranslations("task");
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/api/v1/tasks?limit=1000");
        const json = (await res.json()) as { data?: TaskDTO[] };
        const data = json.data ?? [];
        if (active) {
          setTasks(
            data
              .filter((tk) => tk.dueDate)
              .map((tk) => ({
                id: tk.id,
                title: tk.title,
                status: tk.status,
                priority: tk.priority,
                dueDate: tk.dueDate,
                startDate: tk.startDate == null ? null : tk.startDate,
                progress: tk.progress == null ? null : tk.progress,
              })),
          );
        }
      } catch {
        /* leave empty on failure */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleMove = async (id: string, dueDate: string, startDate: string | null) => {
    await apiFetch(`/api/v1/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ dueDate, startDate }),
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-semibold text-fg-primary">{t("calendar")}</h1>
      {loading ? (
        <div className="text-sm text-fg-muted">…</div>
      ) : (
        <CalendarView tasks={tasks} onMove={handleMove} />
      )}
    </div>
  );
}
