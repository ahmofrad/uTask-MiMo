import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { getTaskComments, createComment } from "@/lib/comments";
import { ensureWatcher } from "@/lib/watchers";
import { checkIdempotency, setIdempotencyResult } from "@/lib/idempotency";
import { logger } from "@/lib/logging";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const comments = await getTaskComments(params.id);

  return NextResponse.json({ data: comments });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const permitted = await can(session.user.id, "comment:create");
    if (!permitted) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    // Idempotency check
    const idempotencyKey = request.headers.get("idempotency-key");
    if (idempotencyKey) {
      const cached = checkIdempotency(idempotencyKey);
      if (cached.hit) {
        return NextResponse.json(cached.response.body, { status: cached.response.status });
      }
    }

    const body = await request.json();
    const { bodyMarkdown, parentCommentId } = body as { bodyMarkdown?: string; parentCommentId?: string };

    if (!bodyMarkdown) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "bodyMarkdown is required" } },
        { status: 400 },
      );
    }

    const comment = await createComment({
      taskId: params.id,
      authorId: session.user.id,
      bodyMarkdown,
      parentCommentId: parentCommentId ?? null,
    });

    await logAudit({ actorUserId: session.user.id, action: "comment_created", entityType: "comment", entityId: comment.id, after: comment as never });

    // Auto-watch on comment
    await ensureWatcher(params.id, session.user.id);

    await emitTaskEvent("comment.created", params.id, { id: comment.id, taskId: params.id, bodyMarkdown: comment.bodyMarkdown }, session.user.id);

    const responseBody = { data: comment };

    if (idempotencyKey) {
      setIdempotencyResult(idempotencyKey, 201, responseBody);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    logger.error({ err, taskId: params.id }, "Failed to create comment");
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" } },
      { status: 500 },
    );
  }
}
