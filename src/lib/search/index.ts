import { prisma } from "@/lib/db";

type SearchType = "task" | "comment" | "project" | "custom_field" | "all";

export async function search(params: {
  query: string;
  type?: SearchType;
  limit?: number;
}) {
  const type = params.type ?? "all";
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const q = params.query.trim();

  const results: Record<string, unknown[]> = {};

  if (type === "all" || type === "task") {
    results.tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
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
        deletedAt: null,
        bodyMarkdown: { contains: q, mode: "insensitive" },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
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
        archivedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, color: true, createdAt: true },
    });
  }

  if (type === "all" || type === "custom_field") {
    results.customFieldValues = await prisma.customFieldValue.findMany({
      where: {
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
