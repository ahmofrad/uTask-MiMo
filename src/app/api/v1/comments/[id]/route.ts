import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadTask } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { getCommentById, updateComment, deleteComment } from "@/lib/comments";
import { commentUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

async function checkCommentAccess(commentId: string, userId: string) {
  const comment = await getCommentById(commentId);
  if (!comment || comment.deletedAt) return { comment: null, status: 404 as const };

  const task = await prisma.task.findUnique({
    where: { id: comment.taskId },
    select: { id: true, projectId: true, deletedAt: true },
  });
  if (!task || task.deletedAt || !(await canReadTask(userId, task.id))) {
    return { comment: null, status: 404 as const };
  }
  if (!(await canProject(userId, "comment:create", task.projectId))) {
    return { comment: null, status: 403 as const };
  }

  return { comment, status: null };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const access = await checkCommentAccess(resolvedParams.id, userId);
  if (access.status) return NextResponse.json({ error: { code: access.status === 404 ? "NOT_FOUND" : "FORBIDDEN" } }, { status: access.status });
  const { comment } = access;
  if (!comment || comment.authorId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const parsed = commentUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });

  const result = await updateComment(resolvedParams.id, userId, { bodyMarkdown: parsed.data.bodyMarkdown });
  if (!result || "forbidden" in result) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  await logAudit({ actorUserId: userId, action: "comment_updated", entityType: "comment", entityId: resolvedParams.id, before: comment as never, after: result as never });
  return NextResponse.json({ data: result });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const access = await checkCommentAccess(resolvedParams.id, userId);
  if (access.status) return NextResponse.json({ error: { code: access.status === 404 ? "NOT_FOUND" : "FORBIDDEN" } }, { status: access.status });
  const { comment } = access;
  if (!comment || comment.authorId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const result = await deleteComment(resolvedParams.id, userId);
  if (!result || "forbidden" in result) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  await logAudit({ actorUserId: userId, action: "comment_deleted", entityType: "comment", entityId: resolvedParams.id, before: comment as never });
  return NextResponse.json({ data: { success: true } });
}
