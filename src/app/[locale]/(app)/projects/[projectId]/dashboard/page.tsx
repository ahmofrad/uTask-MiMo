import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function ProjectDashboardPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const [totalTasks, openTasks, inProgressTasks, doneTasks] = await Promise.all([
    prisma.task.count({ where: { projectId: projectId, deletedAt: null } }),
    prisma.task.count({ where: { projectId: projectId, deletedAt: null, status: "open" } }),
    prisma.task.count({ where: { projectId: projectId, deletedAt: null, status: "in_progress" } }),
    prisma.task.count({ where: { projectId: projectId, deletedAt: null, status: "done" } }),
  ]);

  const stats = [
    { label: t("project.dashboard.total"), value: totalTasks, color: "bg-bg-surface text-fg-primary" },
    { label: t("task.status.open"), value: openTasks, color: "bg-info-bg text-info" },
    { label: t("task.status.in_progress"), value: inProgressTasks, color: "bg-warning-bg text-warning" },
    { label: t("task.status.done"), value: doneTasks, color: "bg-success-bg text-success" },
  ];

  return (
    <div className="px-4 py-8">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">{t("project.dashboard.title")}</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-xl border border-border-primary p-5 ${stat.color}`}>
            <div className="text-3xl font-bold">{stat.value}</div>
            <div className="text-sm opacity-80 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-bg-surface border border-border-primary rounded-xl p-6">
        <h2 className="text-lg font-semibold text-fg-primary mb-4">{t("project.dashboard.statusBreakdown")}</h2>
        <div className="space-y-3">
          {[
            { label: t("task.status.open"), count: openTasks, color: "bg-info" },
            { label: t("task.status.in_progress"), count: inProgressTasks, color: "bg-warning" },
            { label: t("task.status.done"), count: doneTasks, color: "bg-success" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-sm text-fg-secondary w-24">{item.label}</span>
              <div className="flex-1 h-2 bg-bg-surface-2 rounded-full overflow-hidden">
                <div className={`h-full ${item.color} rounded-full`}
                  style={{ width: `${totalTasks > 0 ? (item.count / totalTasks) * 100 : 0}%` }} />
              </div>
              <span className="text-sm text-fg-muted w-8 text-end">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}