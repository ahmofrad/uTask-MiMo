import { prisma } from "@/lib/db";

const COMMENT_INCLUDE = {
  author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
} as const;

export async function getTaskComments(taskId: string) {
  return prisma.comment.findMany({
    where: { taskId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      ...COMMENT_INCLUDE,
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: COMMENT_INCLUDE,
      },
    },
  });
}

export async function getCommentById(id: string) {
  return prisma.comment.findUnique({ where: { id } });
}

export async function createComment(data: {
  taskId: string;
  authorId: string;
  bodyMarkdown: string;
  parentCommentId?: string | null;
}) {
  const { renderMarkdown } = await import("@/lib/markdown/render");
  const sanitized = renderMarkdown(data.bodyMarkdown);

  return prisma.comment.create({
    data: {
      taskId: data.taskId,
      authorId: data.authorId,
      bodyMarkdown: sanitized,
      parentCommentId: data.parentCommentId ?? null,
    },
    include: COMMENT_INCLUDE,
  });
}

export async function updateComment(
  id: string,
  userId: string,
  data: { bodyMarkdown: string },
) {
  const comment = await prisma.comment.findFirst({ where: { id, deletedAt: null } });
  if (!comment) return null;
  if (comment.authorId !== userId) return { forbidden: true as const };

  const { renderMarkdown } = await import("@/lib/markdown/render");
  const sanitized = renderMarkdown(data.bodyMarkdown);

  return prisma.comment.update({
    where: { id },
    data: { bodyMarkdown: sanitized, editedAt: new Date() },
    include: COMMENT_INCLUDE,
  });
}

export async function deleteComment(id: string, userId: string) {
  const comment = await prisma.comment.findFirst({ where: { id, deletedAt: null } });
  if (!comment) return null;
  if (comment.authorId !== userId) return { forbidden: true as const };

  await prisma.comment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return { success: true };
}
