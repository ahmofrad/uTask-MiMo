import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getTaskStats, getUpcomingTasks } from "@/lib/tasks";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { PriorityBadge } from "@/components/task/priority-badge";
import { DueDateChip } from "@/components/task/due-date-chip";
import { EmptyState } from "@/components/empty-state";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const t = await getTranslations("home");
  const [stats, upcoming] = await Promise.all([
    getTaskStats(userId),
    getUpcomingTasks(userId, 6),
  ]);

  const rawName = session.user.name || session.user.email || "";
  const name = rawName.includes("@") ? rawName.split("@")[0]! : rawName;

  const statCards = [
    { key: "myTasks", label: t("myTasks"), value: stats.active, cardTone: "bg-accent-bg/70 border-accent/25", valueTone: "text-accent" },
    { key: "dueSoon", label: t("dueSoon"), value: stats.dueSoon, cardTone: "bg-warning-bg/70 border-warning/25", valueTone: "text-warning" },
    { key: "overdue", label: t("overdue"), value: stats.overdue, cardTone: "bg-danger-bg/70 border-danger/25", valueTone: "text-danger" },
    { key: "completed", label: t("completed"), value: stats.done, cardTone: "bg-success-bg/70 border-success/25", valueTone: "text-success" },
  ];

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-fg tracking-tight">{t("greeting", { name })}</h1>
        <p className="text-fg-muted mt-1">{t("subtitle")}</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.key} className={`p-5 ${s.cardTone}`}>
            <p className="text-sm text-fg-muted">{s.label}</p>
            <p className={`text-3xl font-bold mt-2 tabular-nums ${s.valueTone}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-fg">{t("upNext")}</h2>
          <Link href="/my-tasks" className="text-sm text-accent hover:underline">
            {t("viewAll")}
          </Link>
        </CardHeader>
        <CardBody className="p-0">
          {upcoming.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title={t("noUpcoming")}
                actionHref="/projects"
                actionLabel={t("viewAll")}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-bg-surface-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg truncate">{task.title}</p>
                      {task.project && (
                        <p className="text-xs text-fg-muted truncate">{task.project.name}</p>
                      )}
                    </div>
                    <PriorityBadge priority={task.priority} />
                    <DueDateChip
                      dueDate={task.dueDate ? task.dueDate.toISOString() : null}
                      isCompleted={task.status === "done"}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
