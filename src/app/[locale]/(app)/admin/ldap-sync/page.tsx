import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getTranslations } from "next-intl/server";
import { LdapSyncDashboard } from "@/components/admin/ldap-sync-dashboard";

export default async function AdminLdapSyncPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const canConfigure = await can(session.user.id, "sso:configure");
  if (!canConfigure) redirect("/");

  const t = await getTranslations("admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg-primary">{t("ldapSyncDashboard")}</h1>
        <p className="mt-1 text-sm text-fg-secondary">{t("ldapSyncDashboardDescription")}</p>
      </div>
      <LdapSyncDashboard />
    </div>
  );
}
