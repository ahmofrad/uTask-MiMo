import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { TagsManager } from "@/components/tags/tags-manager";

export const dynamic = "force-dynamic";

export default async function ProjectTagsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations();

  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) notFound();

  const tags = await prisma.tag.findMany({
    where: { projectId: params.projectId },
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });

  return (
    <div className="px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-fg-primary mb-6">
        {t("task.tags")} — {project.name}
      </h1>
      <TagsManager projectId={params.projectId} initialTags={tags} />
    </div>
  );
}