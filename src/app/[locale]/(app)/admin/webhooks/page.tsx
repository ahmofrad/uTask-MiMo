import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime } from "@/lib/date/format";
import { webhookSecretState } from "@/lib/webhook";

export default async function AdminWebhooksPage() {
  const session = await auth();
  const canManage = session?.user?.id && (await can(session.user.id, "webhook:manage"));

  const locale = await getLocale();
  const t = await getTranslations("webhook");
  const tCommon = await getTranslations("common");
  const tAdmin = await getTranslations("admin");

  const webhooks = canManage ? await prisma.webhook.findMany({ orderBy: { createdAt: "desc" } }) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        {!canManage ? (
          <p className="text-fg-muted">{t("noPermission")}</p>
        ) : webhooks.length === 0 ? (
          <p className="text-fg-muted text-center py-8">{t("empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="text-start p-3 text-xs font-medium text-fg-muted uppercase tracking-wide">{t("fields.name")}</th>
                <th className="text-start p-3 text-xs font-medium text-fg-muted uppercase tracking-wide">{t("fields.url")}</th>
                <th className="text-start p-3 text-xs font-medium text-fg-muted uppercase tracking-wide">{t("fields.events")}</th>
                <th className="text-start p-3 text-xs font-medium text-fg-muted uppercase tracking-wide">{t("fields.active")}</th>
                <th className="text-start p-3 text-xs font-medium text-fg-muted uppercase tracking-wide">{tAdmin("created")}</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((wh) => (
                <tr key={wh.id} className="border-b border-border-secondary last:border-b-0 hover:bg-bg-secondary/50 transition-colors">
                  <td className="p-3 text-fg-primary font-medium">
                    {wh.name}
                    {webhookSecretState(wh.secret) === "broken" && (
                      <span
                        data-testid={`webhook-secret-broken-${wh.id}`}
                        title={t("secretBroken")}
                        className="ms-2 inline-block align-middle rounded-full bg-destructive/10 text-destructive border border-destructive/30 px-2 py-0.5 text-xs"
                      >
                        {t("secretBrokenShort")}
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-fg-muted">{wh.url}</td>
                  <td className="p-3 text-fg-secondary">{wh.events.join(", ")}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${wh.active ? "bg-success-bg text-success" : "bg-bg-surface-2 text-fg-muted"}`}>
                      {wh.active ? tCommon("yes") : tCommon("no")}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-fg-muted">{formatDateTime(wh.createdAt, locale as "fa-IR" | "en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
