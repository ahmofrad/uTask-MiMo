import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getTranslations } from "next-intl/server";
import { ProjectTemplatesManager } from "@/components/project/project-templates-manager";

export default async function AdminTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const canCreate = await can(session.user.id, "project:create");
  if (!canCreate) redirect("/");

  const t = await getTranslations("admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg-primary">{t("templates")}</h1>
        <p className="mt-1 text-sm text-fg-secondary">{t("templatesDescription")}</p>
      </div>
      <ProjectTemplatesManager />
    </div>
  );
}
