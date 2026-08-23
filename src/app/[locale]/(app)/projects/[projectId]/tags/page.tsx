import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { TagsManager } from "@/components/tags/tags-manager";
import { canReadProject } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ProjectTagsPage(props: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations();
  if (!(await canReadProject(session.user.id, projectId))) notFound();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const tags = await prisma.tag.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });

  return (
    <div className="px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">
        {t("task.tags")} — {project.name}
      </h1>
      <TagsManager projectId={projectId} initialTags={tags} />
    </div>
  );
}