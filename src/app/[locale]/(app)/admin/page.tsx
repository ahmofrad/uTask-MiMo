import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function AdminOverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("admin");

  const [userCount, taskCount, projectCount, webhookCount] = await Promise.all([
    prisma.user.count({ where: { status: "active" } }),
    prisma.task.count({ where: { deletedAt: null } }),
    prisma.project.count(),
    prisma.webhook.count({ where: { active: true } }),
  ]);

  const stats = [
    { label: t("activeUsers"), value: userCount, color: "bg-info-bg text-info" },
    { label: t("tasks"), value: taskCount, color: "bg-success-bg text-success" },
    { label: t("projects"), value: projectCount, color: "bg-accent-bg text-accent" },
    { label: t("webhooks"), value: webhookCount, color: "bg-warning-bg text-warning" },
  ];

  return (
    <div className="px-4 py-8">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">{t("overview")}</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-xl border border-border-primary p-5 ${stat.color}`}>
            <div className="text-3xl font-bold">{stat.value}</div>
            <div className="text-sm opacity-80 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-bg-surface border border-border-primary rounded-xl p-6">
        <h2 className="text-lg font-semibold text-fg-primary mb-4">{t("systemHealth")}</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-secondary">{t("database")}</span>
            <span className="text-sm text-success flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" /> {t("healthy")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-secondary">{t("redis")}</span>
            <span className="text-sm text-success flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" /> {t("healthy")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-secondary">{t("queue")}</span>
            <span className="text-sm text-success flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" /> {t("pending", { count: 0 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
