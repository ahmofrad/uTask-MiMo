import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadTask } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { deleteAttachment, updateAttachment } from "@/lib/attachments";
import { attachmentUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const task = await prisma.task.findUnique({
    where: { id: resolvedParams.id },
    select: { projectId: true, deletedAt: true },
  });
  if (!task || task.deletedAt || !(await canReadTask(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  if (!(await canProject(userId, "task:edit_any", task.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const parsed = attachmentUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name } = parsed.data;

  try {
    const attachment = await updateAttachment(
      resolvedParams.attachmentId,
      resolvedParams.id,
      userId,
      { name: name.trim() },
    );
    return NextResponse.json({ data: attachment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Attachment not found") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const task = await prisma.task.findUnique({
    where: { id: resolvedParams.id },
    select: { projectId: true, deletedAt: true },
  });
  if (!task || task.deletedAt || !(await canReadTask(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  if (!(await canProject(userId, "task:edit_any", task.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  try {
    await deleteAttachment(resolvedParams.attachmentId, resolvedParams.id, userId);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Attachment not found") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}