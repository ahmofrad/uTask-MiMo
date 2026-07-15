import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canProject } from "@/lib/rbac";
import { getTaskById } from "@/lib/tasks";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { getTaskComments, createComment } from "@/lib/comments";
import { parseMentions, type MentionMatch } from "@/lib/mentions";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import { ensureWatcher } from "@/lib/watchers";
import { checkIdempotency, setIdempotencyResult } from "@/lib/idempotency";
import { logger } from "@/lib/logging";

async function checkCommentAccess(userId: string, taskId: string): Promise<{ allowed: boolean; projectId: string | undefined }> {
  if (await can(userId, "task:edit_any")) {
    const task = await getTaskById(taskId);
    return { allowed: true, projectId: task?.projectId };
  }
  const task = await getTaskById(taskId);
  if (!task) return { allowed: false, projectId: undefined };
  const allowed = await canProject(userId, "comment:create", task.projectId);
  return { allowed, projectId: task.projectId };
}

async function resolveMentionTarget(m: MentionMatch): Promise<string | null> {
  if (!m.userId) return null;
  const user = m.userId.includes("@")
    ? await prisma.user.findUnique({ where: { email: m.userId } })
    : await prisma.user.findUnique({ where: { id: m.userId } });
  return user?.id ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const access = await checkCommentAccess(userId, params.id);
  if (!access.allowed) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const comments = await getTaskComments(params.id);

  return NextResponse.json({ data: comments });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requireAuth(request, { params });
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const access = await checkCommentAccess(userId, params.id);
    if (!access.allowed) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    // Idempotency check
    const idempotencyKey = request.headers.get("idempotency-key");
    if (idempotencyKey) {
      const cached = await checkIdempotency(idempotencyKey);
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
      authorId: userId,
      bodyMarkdown,
      parentCommentId: parentCommentId ?? null,
    });

    await logAudit({ actorUserId: userId, action: "comment_created", entityType: "comment", entityId: comment.id, after: comment as never });

    // Auto-watch on comment
    await ensureWatcher(params.id, userId);

    await emitTaskEvent("comment.created", params.id, { id: comment.id, taskId: params.id, bodyMarkdown: comment.bodyMarkdown }, userId);

    // In-app notifications: all task assignees + any mentioned users
    const task = await getTaskById(params.id);
    const taskTitle = task?.title ?? "";
    const assigneeIds = (task?.assignees ?? []).map((a) => a.userId);
    for (const aid of assigneeIds) {
      if (aid !== userId) {
        await notify({
          userId: aid,
          type: "commented",
          taskId: params.id,
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
          taskId: params.id,
          payload: { taskTitle, by: comment.author.displayName },
        });
      }
    }

    const responseBody = { data: comment };

    if (idempotencyKey) {
      await setIdempotencyResult(idempotencyKey, 201, responseBody);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    logger.error({ err, taskId: params.id }, "Failed to create comment");
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create comment" } },
      { status: 500 },
    );
  }
}