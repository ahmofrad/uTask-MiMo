import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("reports");

  return (
    <div className="px-6 py-6">
      <h1 className="text-2xl font-bold text-fg-primary mb-8">{t("myDashboard")}</h1>
      <p className="text-fg-muted">Your personal dashboard.</p>
    </div>
  );
}
