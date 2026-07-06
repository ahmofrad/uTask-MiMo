import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "audit:view");
  if (!allowed) redirect("/");

  const t = await getTranslations("audit");

  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { occurredAt: "desc" },
    include: {
      actor: { select: { id: true, displayName: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>
        <p className="text-sm text-fg-tertiary">{t("last100")}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-start p-2 text-fg-secondary">{t("time")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("actor")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("action")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("entity")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("id")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-border-primary hover:bg-bg-secondary">
                <td className="p-2 text-fg-primary whitespace-nowrap font-mono text-xs">
                  {new Date(log.occurredAt).toISOString().slice(0, 19).replace("T", " ")}
                </td>
                <td className="p-2 text-fg-primary whitespace-nowrap">
                  {log.actor?.displayName ?? log.actor?.email ?? log.actorUserId ?? "system"}
                </td>
                <td className="p-2">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                    {log.action.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="p-2 text-fg-secondary">{log.entityType}</td>
                <td className="p-2 text-fg-secondary font-mono text-xs">{log.entityId.slice(0, 8)}...</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-fg-tertiary">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-fg-tertiary">
        <Link href="/api/v1/audit-log" className="text-accent hover:underline">
          {t("apiEndpoint")}
        </Link>
      </div>
    </div>
  );
}
