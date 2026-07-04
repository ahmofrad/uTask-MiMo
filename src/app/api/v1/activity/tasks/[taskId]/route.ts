import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

export async function GET(
  _request: Request,
  { params }: { params: { taskId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const [auditLogs, comments] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "task", entityId: params.taskId },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: { actor: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.comment.findMany({
      where: { taskId: params.taskId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    }),
  ]);

  const activity = [
    ...auditLogs.map((l) => ({
      id: l.id,
      type: "audit" as const,
      action: l.action,
      actorId: l.actorUserId,
      actorName: l.actor?.displayName ?? "System",
      createdAt: l.occurredAt.toISOString(),
    })),
    ...comments.map((c) => ({
      id: c.id,
      type: "comment" as const,
      body: c.bodyMarkdown,
      authorId: c.authorId,
      authorName: c.author.displayName,
      createdAt: c.createdAt.toISOString(),
      parentCommentId: c.parentCommentId,
    })),
  ];

  activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ data: activity });
}
