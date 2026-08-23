import { NextResponse } from "next/server";
import { authenticatePublicApi, withPublicApiRateLimit } from "@/lib/public-api/middleware";
import { canProject, canReadProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { createComment } from "@/lib/comments";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { acquirePending, checkIdempotency, releasePending, setIdempotencyResult } from "@/lib/idempotency";
import { publicCommentCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";
import { sha256 } from "@/lib/crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, rateLimit, error } = await authenticatePublicApi(request, "tasks:read");
  if (error) return error;

  const task = await prisma.task.findUnique({
    where: { id: resolvedParams.id },
    select: { projectId: true },
  });
  if (!task || !(await canReadProject(userId, task.projectId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const comments = await prisma.comment.findMany({
    where: { taskId: resolvedParams.id, deletedAt: null },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      author: { select: { id: true, displayName: true } },
    },
  });
  const hasMore = comments.length > limit;
  if (hasMore) comments.pop();
  const lastItem = comments[comments.length - 1];

  return withPublicApiRateLimit(NextResponse.json({
    data: comments,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  }), rateLimit);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request, "comments:write");
  if (error) return error;

  const task = await prisma.task.findUnique({
    where: { id: resolvedParams.id },
    select: { projectId: true },
  });
  if (!task) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  if (!(await canProject(userId, "comment:create", task.projectId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not a member of this project" } },
      { status: 403 },
    );
  }

  const parsed = publicCommentCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });

  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey) {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" } }, { status: 400 });
  }
  const idempotencyScope = {
    userId,
    route: `public:comments:create:${resolvedParams.id}`,
    bodyHash: sha256(JSON.stringify(parsed.data)),
  };
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
  if (cached.hit) return NextResponse.json(cached.response.body, { status: cached.response.status });
  const pending = await acquirePending(idempotencyKey, idempotencyScope);
  if (pending === "unavailable") {
    return NextResponse.json({ error: { code: "IDEMPOTENCY_UNAVAILABLE", message: "Idempotency storage is unavailable" } }, { status: 503 });
  }
  if (pending !== "acquired") {
    return NextResponse.json({ error: { code: "REQUEST_IN_PROGRESS" } }, { status: 409 });
  }

  try {
    const comment = await createComment({
      taskId: resolvedParams.id,
      authorId: userId,
      bodyMarkdown: parsed.data.bodyMarkdown,
    });

    await logAudit({ actorUserId: userId, action: "comment_created", entityType: "comment", entityId: comment.id, after: comment as never });
    await emitTaskEvent("comment.created", resolvedParams.id, { id: comment.id, taskId: resolvedParams.id, bodyMarkdown: comment.bodyMarkdown }, userId);

    const body = { data: comment };
    await setIdempotencyResult(idempotencyKey, 201, body, idempotencyScope);
    return NextResponse.json(body, { status: 201 });
  } finally {
    await releasePending(idempotencyKey, idempotencyScope);
  }
}
