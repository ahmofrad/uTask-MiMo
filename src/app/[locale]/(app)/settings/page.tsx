import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("settings");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("mySettings")}</h1>
      <p className="text-fg-secondary">{t("comingSoon")}</p>
    </div>
  );
}
