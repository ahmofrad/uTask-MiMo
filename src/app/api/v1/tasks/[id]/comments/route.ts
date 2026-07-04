import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const comments = await prisma.comment.findMany({
    where: { taskId: params.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  return NextResponse.json({ data: comments });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "comment:create");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const { bodyMarkdown, parentCommentId } = body as { bodyMarkdown?: string; parentCommentId?: string };

  if (!bodyMarkdown) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "bodyMarkdown is required" } },
      { status: 400 },
    );
  }

  const comment = await prisma.comment.create({
    data: {
      taskId: params.id,
      authorId: session.user.id,
      bodyMarkdown,
      parentCommentId: parentCommentId ?? null,
    },
    include: {
      author: { select: { id: true, displayName: true, email: true } },
    },
  });

  await logAudit({ actorUserId: session.user.id, action: "comment_created", entityType: "comment", entityId: comment.id, after: comment as never });

  await emitTaskEvent("comment.created", params.id, { id: comment.id, taskId: params.id, bodyMarkdown: comment.bodyMarkdown }, session.user.id);

  return NextResponse.json({ data: comment }, { status: 201 });
}
