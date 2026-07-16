import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function ProjectSettingsPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  return (
    <div className="px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">{t("project.settings.title")}</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("project.fields.name")}</label>
          <input type="text" defaultValue={project.name}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("project.fields.description")}</label>
          <textarea defaultValue={project.description ?? ""} rows={3}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("project.fields.visibility")}</label>
          <select defaultValue={project.visibility}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm">
            <option value="private">{t("project.visibilityOptions.private")}</option>
            <option value="department">{t("project.visibilityOptions.department")}</option>
            <option value="org">{t("project.visibilityOptions.org")}</option>
          </select>
        </div>

        <div className="border-t border-border-primary pt-6">
          <h3 className="text-sm font-medium text-destructive mb-2">{t("project.settings.dangerZone")}</h3>
          <p className="text-xs text-fg-muted mb-3">
            {t("project.settings.dangerZoneDesc")}
          </p>
          <button className="px-4 py-2 text-sm font-medium rounded-md border border-danger text-destructive hover:bg-danger-bg transition-colors">
            {t("project.settings.archiveButton")}
          </button>
        </div>
      </div>
    </div>
  );
}