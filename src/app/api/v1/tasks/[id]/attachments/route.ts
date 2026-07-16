import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { can, canProject } from "@/lib/rbac";
import { getAttachmentsByTask, getPresignedUrl, createAttachment } from "@/lib/attachments";

async function hasProjectAccess(userId: string, taskId: string): Promise<boolean> {
  if (await can(userId, "task:edit_any")) return true;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return false;
  return canProject(userId, "task:edit_any", task.projectId) ||
    canProject(userId, "task:edit_own", task.projectId) ||
    canProject(userId, "comment:create", task.projectId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(request.url);
  const presign = searchParams.get("presign") === "true";
  const attachmentId = searchParams.get("attachmentId");

  if (presign && attachmentId) {
    if (!(await hasProjectAccess(userId, resolvedParams.id))) {
      return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const url = await getPresignedUrl(attachmentId, resolvedParams.id);
    if (!url) {
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: { url } });
  }

  if (!(await hasProjectAccess(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const attachments = await getAttachmentsByTask(resolvedParams.id);
  return NextResponse.json({ data: attachments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:edit_any");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "file is required" } },
      { status: 400 },
    );
  }

  try {
    const attachment = await createAttachment(
      resolvedParams.id,
      {
        name: file.name,
        type: file.type,
        size: file.size,
        buffer: Buffer.from(await file.arrayBuffer()),
      },
      userId,
    );
    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message } }, { status: 400 });
  }
}