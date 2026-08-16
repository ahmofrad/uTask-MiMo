import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { listLdapSources, redactLdapSource } from "@/lib/auth/ldap-sources";
import { LdapSourceList, type LdapSourceView } from "@/components/admin/ldap-source-list";
import { getTranslations } from "next-intl/server";

export default async function AdminActiveDirectoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const canConfigure = await can(session.user.id, "sso:configure");
  if (!canConfigure) redirect("/");

  const t = await getTranslations("admin");

  const sources = (await listLdapSources()).map(
    (source) => redactLdapSource(source) as unknown as LdapSourceView,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg-primary">{t("activeDirectory")}</h1>
          <p className="mt-1 text-sm text-fg-secondary">{t("activeDirectoryDescription")}</p>
        </div>
      </div>
      <LdapSourceList sources={sources} />
    </div>
  );
}
