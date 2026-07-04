import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";

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

  const comment = await prisma.comment.findUnique({ where: { id: params.id } });
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

  const before = await prisma.comment.findUnique({ where: { id: params.id } });

  const updated = await prisma.comment.update({
    where: { id: params.id },
    data: { bodyMarkdown, editedAt: new Date() },
    include: { author: { select: { id: true, displayName: true, email: true } } },
  });

  await logAudit({ actorUserId: session.user.id, action: "comment_updated", entityType: "comment", entityId: params.id, before: before as never, after: updated as never });

  return NextResponse.json({ data: updated });
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

  const comment = await prisma.comment.findUnique({ where: { id: params.id } });
  if (!comment) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (comment.authorId !== session.user.id) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  await prisma.comment.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await logAudit({ actorUserId: session.user.id, action: "comment_deleted", entityType: "comment", entityId: params.id, before: comment as never });

  return NextResponse.json({ data: { success: true } });
}
