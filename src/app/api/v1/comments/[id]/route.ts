import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { getCommentById, updateComment, deleteComment } from "@/lib/comments";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("comment:create");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const comment = await getCommentById(resolvedParams.id);
  if (!comment) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  if (comment.authorId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { bodyMarkdown } = body as { bodyMarkdown?: string };

  if (!bodyMarkdown) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "bodyMarkdown is required" } }, { status: 400 });
  }

  const result = await updateComment(resolvedParams.id, userId, { bodyMarkdown });

  if (!result || "forbidden" in result) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  await logAudit({ actorUserId: userId, action: "comment_updated", entityType: "comment", entityId: resolvedParams.id, before: comment as never, after: result as never });

  return NextResponse.json({ data: result });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("comment:create");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const comment = await getCommentById(resolvedParams.id);
  if (!comment) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (comment.authorId !== userId) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const result = await deleteComment(resolvedParams.id, userId);

  if (!result || "forbidden" in result) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  await logAudit({ actorUserId: userId, action: "comment_deleted", entityType: "comment", entityId: resolvedParams.id, before: comment as never });

  return NextResponse.json({ data: { success: true } });
}