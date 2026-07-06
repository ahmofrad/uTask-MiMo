import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { ActivityEvent } from "./types";

const DEFAULT_LIMIT = 50;

export async function getTaskActivity(
  taskId: string,
  userId: string,
  options?: { cursor?: string; limit?: number },
): Promise<{ items: ActivityEvent[]; nextCursor: string | null }> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });

  if (!task) {
    return { items: [], nextCursor: null };
  }

  const hasAccess = await can(userId, "task:edit_any");
  if (!hasAccess) {
    return { items: [], nextCursor: null };
  }

  const [auditLogs, comments] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "task", entityId: taskId },
      orderBy: { occurredAt: "desc" },
      take: limit + 1,
      ...(options?.cursor
        ? { skip: 1, cursor: { id: options.cursor } }
        : {}),
      include: { actor: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.comment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(options?.cursor
        ? { skip: 1, cursor: { id: options.cursor } }
        : {}),
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    }),
  ]);

  const auditHasMore = auditLogs.length > limit;
  const commentHasMore = comments.length > limit;
  if (auditHasMore) auditLogs.pop();
  if (commentHasMore) comments.pop();

  const activity: ActivityEvent[] = [
    ...auditLogs.map((l) => ({
      type: "audit" as const,
      id: l.id,
      action: l.action,
      actorId: l.actorUserId,
      actorName: l.actor?.displayName ?? "System",
      createdAt: l.occurredAt.toISOString(),
    })),
    ...comments.map((c) => ({
      type: "comment" as const,
      id: c.id,
      body: c.bodyMarkdown,
      authorId: c.authorId,
      authorName: c.author.displayName,
      createdAt: c.createdAt.toISOString(),
      parentCommentId: c.parentCommentId,
    })),
  ];

  activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const sliced = activity.slice(0, limit);
  const hasMore = activity.length > limit;
  const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null;

  return { items: sliced, nextCursor };
}
