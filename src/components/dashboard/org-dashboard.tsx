import { getTranslations } from "next-intl/server";
import { getOrgReport } from "@/lib/reports";

export async function OrgDashboard() {
  const t = await getTranslations("admin");
  const report = await getOrgReport();

  const cards = [
    { label: t("activeUsers"), value: report.totalUsers, tone: "bg-info-bg text-info" },
    { label: t("tasks"), value: report.totalTasks, tone: "bg-tone-secondary-bg text-tone-secondary" },
    { label: t("projects"), value: report.totalProjects, tone: "bg-accent-bg text-accent" },
    { label: t("completed"), value: report.completedTasks, tone: "bg-tone-tertiary-bg text-tone-tertiary" },
  ];

  const completionRate =
    report.totalTasks > 0 ? Math.round((report.completedTasks / report.totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border border-border-primary p-5 ${c.tone}`}>
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm opacity-80 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-bg-surface border border-border-primary rounded-xl p-6">
        <h2 className="text-lg font-semibold text-fg-primary mb-4">{t("taskCompletionRate")}</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-tone-secondary rounded-full"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <span className="text-sm font-medium text-fg-primary">
            {completionRate}%
          </span>
        </div>
      </div>
    </div>
  );
}
