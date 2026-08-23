import { prisma } from "@/lib/db";
import { getUserReadableProjectIds } from "@/lib/projects/queries";

type SearchType = "task" | "comment" | "project" | "custom_field" | "all";

export async function search(params: {
  userId: string;
  query: string;
  type?: SearchType;
  limit?: number;
}) {
  const type = params.type ?? "all";
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const q = params.query.trim();
  const readableProjectIds = await getUserReadableProjectIds(params.userId);
  const projectScope = readableProjectIds === null ? {} : { id: { in: readableProjectIds } };
  const taskScope = readableProjectIds === null ? {} : { projectId: { in: readableProjectIds } };
  const commentScope = readableProjectIds === null ? {} : { task: { projectId: { in: readableProjectIds } } };

  const results: Record<string, unknown[]> = {};

  if (type === "all" || type === "task") {
    results.tasks = await prisma.task.findMany({
      where: {
        ...taskScope,
        deletedAt: null,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        projectId: true,
        createdAt: true,
      },
    });
  }

  if (type === "all" || type === "comment") {
    results.comments = await prisma.comment.findMany({
      where: {
        ...commentScope,
        deletedAt: null,
        bodyMarkdown: { contains: q, mode: "insensitive" },
      },
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        bodyMarkdown: true,
        taskId: true,
        authorId: true,
        createdAt: true,
      },
    });
  }

  if (type === "all" || type === "project") {
    results.projects = await prisma.project.findMany({
      where: {
        ...projectScope,
        archivedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, color: true, createdAt: true },
    });
  }

  if (type === "all" || type === "custom_field") {
    results.customFieldValues = await prisma.customFieldValue.findMany({
      where: {
        ...commentScope,
        task: { ...((commentScope as { task?: Record<string, unknown> }).task ?? {}), deletedAt: null },
        valueText: { contains: q, mode: "insensitive" },
      },
      take: limit,
      include: {
        task: { select: { id: true, title: true } },
        customField: { select: { id: true, name: true, key: true } },
      },
    });
  }

  return results;
}
