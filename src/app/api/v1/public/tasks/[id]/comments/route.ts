import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { renderMarkdown } from "@/lib/markdown/render";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await authenticatePublicApi(request, "tasks:read");
  if (error) return error;

  const comments = await prisma.comment.findMany({
    where: { taskId: params.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json({ data: comments });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { userId, error } = await authenticatePublicApi(request, "comments:write");
  if (error) return error;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
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

  const body = await request.json();
  const { bodyMarkdown } = body as { bodyMarkdown?: string };

  if (!bodyMarkdown) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "bodyMarkdown required" } }, { status: 400 });
  }

  const sanitized = renderMarkdown(bodyMarkdown);

  const comment = await prisma.comment.create({
    data: {
      taskId: params.id,
      authorId: userId,
      bodyMarkdown: sanitized,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "comment_created",
    entityType: "comment",
    entityId: comment.id,
    after: comment as never,
  });

  return NextResponse.json({ data: comment }, { status: 201 });
}
