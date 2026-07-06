import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { getCommentById, updateComment, deleteComment } from "@/lib/comments";

export async function PATCH(
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

  const comment = await getCommentById(params.id);
  if (!comment) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  if (comment.authorId !== session.user.id) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { bodyMarkdown } = body as { bodyMarkdown?: string };

  if (!bodyMarkdown) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "bodyMarkdown is required" } }, { status: 400 });
  }

  const result = await updateComment(params.id, session.user.id, { bodyMarkdown });

  if (!result || "forbidden" in result) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  await logAudit({ actorUserId: session.user.id, action: "comment_updated", entityType: "comment", entityId: params.id, before: comment as never, after: result as never });

  return NextResponse.json({ data: result });
}

export async function DELETE(
  _request: Request,
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

  const comment = await getCommentById(params.id);
  if (!comment) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (comment.authorId !== session.user.id) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const result = await deleteComment(params.id, session.user.id);

  if (!result || "forbidden" in result) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  await logAudit({ actorUserId: session.user.id, action: "comment_deleted", entityType: "comment", entityId: params.id, before: comment as never });

  return NextResponse.json({ data: { success: true } });
}
