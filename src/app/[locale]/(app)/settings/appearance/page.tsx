import { getTranslations } from "next-intl/server";
import { AppearanceSettings } from "@/components/settings/appearance-settings";

export default async function AppearancePage() {
  const t = await getTranslations("settings");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("appearance")}</h1>
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <AppearanceSettings />
      </div>
    </div>
  );
}
