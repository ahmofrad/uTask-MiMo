import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileSettings } from "@/components/settings/profile-settings";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("settings");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg-primary">{t("profile")}</h1>
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <ProfileSettings
          userId={session.user.id}
          name={session.user.name}
          email={session.user.email}
        />
      </div>
    </div>
  );
}
