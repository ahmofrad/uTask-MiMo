import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { listCreatableDepartments } from "@/lib/departments";
import { getTranslations } from "next-intl/server";
import { ProjectCard } from "@/components/project/project-card";
import { ProjectCreateButton } from "@/components/project/project-create-dialog";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tasks: true, members: true } },
      owner: { select: { id: true, displayName: true } },
    },
  });

  const canCreate = await can(session.user.id, "project:create");
  const creatable = await listCreatableDepartments(session.user.id);
  const t = await getTranslations("project");

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>
        {canCreate && (
          <ProjectCreateButton
            departments={creatable.departments}
            requireDepartment={creatable.required}
          />
        )}
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-fg-muted py-12 text-center">{t("title")} — {t("create")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              id={p.id}
              name={p.name}
              description={p.description}
              taskCount={p._count.tasks}
              memberCount={p._count.members}
              color={p.color ?? undefined}
              ownerName={p.owner.displayName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
