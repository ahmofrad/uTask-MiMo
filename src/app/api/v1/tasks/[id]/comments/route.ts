import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadTask } from "@/lib/rbac";
import { getTaskById } from "@/lib/tasks";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { getTaskComments, createComment } from "@/lib/comments";
import { parseMentions, resolveMentionTarget } from "@/lib/mentions";
import { sha256 } from "@/lib/crypto";
import { notify } from "@/lib/notifications";

import { ensureWatcher } from "@/lib/watchers";
import { checkIdempotency, setIdempotencyResult, acquirePending, releasePending, type IdempotencyScope } from "@/lib/idempotency";
import { logger } from "@/lib/logging";
import { commentCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

async function checkCommentAccess(userId: string, taskId: string): Promise<{ allowed: boolean; projectId: string | undefined }> {
  if (!(await canReadTask(userId, taskId))) return { allowed: false, projectId: undefined };
  const task = await getTaskById(taskId);
  if (!task) return { allowed: false, projectId: undefined };
  const allowed = await canProject(userId, "comment:create", task.projectId);
  return { allowed, projectId: task.projectId };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const access = await checkCommentAccess(userId, resolvedParams.id);
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const comments = await getTaskComments(resolvedParams.id);

  return NextResponse.json({ data: comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  let idempotencyKey: string | null = null;
  let idempotencyScope: IdempotencyScope | null = null;
  try {
    const authResult = await requireAuth(request, { params: resolvedParams });
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    idempotencyKey = request.headers.get("idempotency-key");
    idempotencyScope = { userId, route: `comments:create:${resolvedParams.id}` };

    const access = await checkCommentAccess(userId, resolvedParams.id);
    if (!access.allowed) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    const parsed = commentCreateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
    const { bodyMarkdown, parentCommentId } = parsed.data;
    idempotencyScope = {
      userId,
      route: `comments:create:${resolvedParams.id}`,
      bodyHash: sha256(JSON.stringify(parsed.data)),
    };

    if (!idempotencyKey) {
      return NextResponse.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" } }, { status: 400 });
    }
    const cached = await checkIdempotency(idempotencyKey, idempotencyScope);
    if (cached.unavailable) {
      return NextResponse.json({ error: { code: "IDEMPOTENCY_UNAVAILABLE", message: "Idempotency storage is unavailable" } }, { status: 503 });
    }
    if (cached.conflict) {
      return NextResponse.json(
        { error: { code: "IDEMPOTENCY_KEY_REUSE", message: "Idempotency-Key was already used with a different request body" } },
        { status: 409 },
      );
    }
    if (cached.hit) {
      return NextResponse.json(cached.response.body, { status: cached.response.status });
    }
    const pending = await acquirePending(idempotencyKey, idempotencyScope);
    if (pending === "unavailable") {
      return NextResponse.json({ error: { code: "IDEMPOTENCY_UNAVAILABLE", message: "Idempotency storage is unavailable" } }, { status: 503 });
    }
    if (pending !== "acquired") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Request already in progress" } },
        { status: 409 },
      );
    }

    const comment = await createComment({
      taskId: resolvedParams.id,
      authorId: userId,
      bodyMarkdown,
      parentCommentId: parentCommentId ?? null,
    });

    await logAudit({ actorUserId: userId, action: "comment_created", entityType: "comment", entityId: comment.id, after: comment as never });

    // Auto-watch on comment
    await ensureWatcher(resolvedParams.id, userId);

    await emitTaskEvent("comment.created", resolvedParams.id, { id: comment.id, taskId: resolvedParams.id, bodyMarkdown: comment.bodyMarkdown }, userId);

    // In-app notifications: all task assignees + any mentioned users
    const task = await getTaskById(resolvedParams.id);
    const taskTitle = task?.title ?? "";
    const assigneeIds = (task?.assignees ?? []).map((a) => a.userId);
    for (const aid of assigneeIds) {
      if (aid !== userId) {
        await notify({
          userId: aid,
          type: "commented",
          taskId: resolvedParams.id,
          payload: { taskTitle },
        });
      }
    }
    const mentions = parseMentions(bodyMarkdown);
    for (const m of mentions) {
      const uid = await resolveMentionTarget(m);
      if (uid && uid !== userId && !assigneeIds.includes(uid)) {
        await notify({
          userId: uid,
          type: "mentioned",
          taskId: resolvedParams.id,
          payload: { taskTitle, by: comment.author.displayName },
        });
      }
    }

    const responseBody = { data: comment };

    if (idempotencyKey) {
      await setIdempotencyResult(idempotencyKey, 201, responseBody, idempotencyScope);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    logger.error({ err, taskId: resolvedParams.id }, "Failed to create comment");
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create comment" } },
      { status: 500 },
    );
  } finally {
    if (idempotencyKey && idempotencyScope) await releasePending(idempotencyKey, idempotencyScope);
  }
}