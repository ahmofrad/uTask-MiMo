import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function StoragePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations();

  return (
    <div className="px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-fg-primary">{t("admin.storage.title")}</h1>
        <button className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors">
          {t("admin.storage.testConnection")}
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-3">{t("admin.storage.provider")}</label>
          <div className="space-y-2">
            {[t("admin.storage.providerS3"), t("admin.storage.providerLocal")].map((provider) => (
              <label key={provider} className="flex items-center gap-2 text-sm text-fg-primary">
                <input type="radio" name="provider" defaultChecked={provider.includes("S3")} className="accent-accent" />
                {provider}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-fg-secondary mb-3">{t("admin.storage.s3Settings")}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("admin.storage.endpoint")}</label>
              <input type="url" className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("admin.storage.bucket")}</label>
              <input type="text" className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("admin.storage.accessKey")}</label>
              <input type="text" className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm" />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("admin.storage.secretKey")}</label>
              <input type="password" className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm" />
            </div>
          </div>
        </div>

        <div className="border-t border-border-primary pt-6">
          <button className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity">
            {t("admin.saveConfig")}
          </button>
        </div>
      </div>
    </div>
  );
}