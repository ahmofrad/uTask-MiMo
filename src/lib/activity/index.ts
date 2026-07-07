import { prisma } from "@/lib/db";
import { can, canProject } from "@/lib/rbac";
import type { ActivityEvent } from "./types";

const DEFAULT_LIMIT = 50;

function parseCursor(cursor: string): { type: "audit" | "comment"; id: string } | null {
  const sep = cursor.indexOf(":");
  if (sep === -1) return null;
  const type = cursor.slice(0, sep);
  const id = cursor.slice(sep + 1);
  if (type !== "audit" && type !== "comment") return null;
  return { type, id };
}

async function hasReadAccess(userId: string, taskId: string): Promise<boolean> {
  if (await can(userId, "task:edit_any")) return true;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return false;
  return canProject(userId, "task:edit_any", task.projectId) ||
    canProject(userId, "task:edit_own", task.projectId) ||
    canProject(userId, "comment:create", task.projectId);
}

export async function getTaskActivity(
  taskId: string,
  userId: string,
  options?: { cursor?: string; limit?: number },
): Promise<{ items: ActivityEvent[]; nextCursor: string | null; hasMore: boolean }> {
  const limit = options?.limit ?? DEFAULT_LIMIT;

  if (!(await hasReadAccess(userId, taskId))) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const parsed = options?.cursor ? parseCursor(options.cursor) : null;

  const [auditLogs, comments] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "task", entityId: taskId },
      orderBy: { occurredAt: "desc" },
      take: limit + 1,
      ...(parsed?.type === "audit" ? { skip: 1, cursor: { id: parsed.id } } : {}),
      include: { actor: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.comment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(parsed?.type === "comment" ? { skip: 1, cursor: { id: parsed.id } } : {}),
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
      details: (l.beforeJson || l.afterJson) ? { before: l.beforeJson, after: l.afterJson } : undefined,
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
  const hasMore = activity.length > limit || auditHasMore || commentHasMore;
  const lastItem = hasMore && sliced.length > 0 ? sliced[sliced.length - 1] : null;
  const nextCursor = lastItem ? `${lastItem.type}:${lastItem.id}` : null;

  return { items: sliced, nextCursor, hasMore };
}
