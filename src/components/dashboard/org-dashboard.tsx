import { getTranslations } from "next-intl/server";
import { getOrgReport } from "@/lib/reports";

export async function OrgDashboard({ organizationId }: { organizationId?: string } = {}) {
  const t = await getTranslations("admin");
  const report = await getOrgReport(organizationId);

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

      <div className="bg-bg-surface border border-border-primary rounded-xl p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-fg-primary mb-1">{t("memberThroughput")}</h2>
        <p className="text-sm text-fg-muted mb-4">{t("memberThroughputHint")}</p>
        {report.memberThroughput.length === 0 ? (
          <p className="text-sm text-fg-tertiary">{t("noMemberActivity")}</p>
        ) : (
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="text-start p-2 font-medium text-fg-muted">{t("member")}</th>
                <th className="text-start p-2 font-medium text-fg-muted">{t("completed30")}</th>
                <th className="text-start p-2 font-medium text-fg-muted">{t("onTimeRate")}</th>
                <th className="text-start p-2 font-medium text-fg-muted">{t("workload")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {report.memberThroughput.map((m) => (
                <tr key={m.userId} className="hover:bg-bg-secondary/50">
                  <td className="p-2 text-fg-primary">{m.displayName}</td>
                  <td className="p-2 text-fg-secondary">{m.completed30}</td>
                  <td className="p-2 text-fg-secondary">
                    {m.onTimeRate === null ? "—" : `${m.onTimeRate}%`}
                  </td>
                  <td className="p-2 text-fg-secondary">{m.workload}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
