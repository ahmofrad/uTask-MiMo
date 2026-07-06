import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function WebhookDetailPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("admin");

  return (
    <div className="px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fg-primary">{t("webhook")}</h1>
          <p className="text-sm text-fg-muted">{t("overviewDeliveriesSettings")}</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors">
            {t("testSend")}
          </button>
          <button className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors">
            {t("disable")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: t("deliveries24h"), value: "0" },
          { label: t("successRate"), value: "—" },
          { label: t("avgDuration"), value: "—" },
          { label: t("lastDelivery"), value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border-primary p-4">
            <div className="text-2xl font-bold text-fg-primary">{stat.value}</div>
            <div className="text-xs text-fg-muted mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-bg-surface border border-border-primary rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-fg-primary mb-4">{t("subscribedEvents")}</h2>
        <div className="flex flex-wrap gap-2">
          {["task.created", "task.updated", "task.deleted", "comment.created"].map((event) => (
            <span key={event} className="text-xs px-2 py-1 rounded-full bg-success-bg text-success">{event}</span>
          ))}
        </div>
      </div>

      <div className="bg-bg-surface border border-border-primary rounded-xl p-6">
        <h2 className="text-lg font-semibold text-fg-primary mb-4">{t("signing")}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-fg-muted">{t("algorithm")}</span>
            <span className="text-fg-primary">{t("hmac")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-muted">{t("secret")}</span>
            <span className="text-fg-primary font-mono">{t("secretMasked")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
