import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "org:settings");
  if (!allowed) redirect("/");

  const t = await getTranslations("settings");

  const settings = await prisma.settings.findMany({
    where: { scope: "org" },
  });

  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = String(s.valueJson ?? "");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("orgSettings")}</h1>
      <div className="max-w-md space-y-4">
        {["siteName", "defaultLocale", "defaultAccent", "sessionTimeoutMinutes"].map((key) => (
          <div key={key}>
            <label className="block text-sm font-medium text-fg-secondary mb-1">
              {key}
            </label>
            <input
              defaultValue={map[key] ?? ""}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-primary text-fg-primary"
              readOnly
            />
          </div>
        ))}
        <p className="text-sm text-fg-tertiary">{t("orgSettingsComingSoon")}</p>
      </div>
    </div>
  );
}
