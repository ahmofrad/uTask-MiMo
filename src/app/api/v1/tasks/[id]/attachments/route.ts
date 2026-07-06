import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { randomUUID } from "@/lib/crypto";
import { putObject } from "@/lib/storage/upload";
import { presignedGet } from "@/lib/storage/download";
import type { AuditAction } from "@prisma/client";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const presign = searchParams.get("presign") === "true";
  const attachmentId = searchParams.get("attachmentId");

  if (presign && attachmentId) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    const url = await presignedGet(attachment.storageKey);
    return NextResponse.json({ data: { url } });
  }

  const attachments = await prisma.attachment.findMany({
    where: { taskId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: attachments });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:edit_any");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "file is required" } },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "File size exceeds 25 MB limit" } },
      { status: 400 },
    );
  }

  const storageKey = `tasks/${params.id}/${randomUUID()}-${file.name}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject(storageKey, buffer, file.type);

  const attachment = await prisma.attachment.create({
    data: {
      taskId: params.id,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey,
      uploadedById: session.user.id,
    },
  });

  await logAudit({ actorUserId: session.user.id, action: "created" as AuditAction, entityType: "attachment", entityId: attachment.id, after: { taskId: params.id, filename: file.name } as never });

  return NextResponse.json({ data: attachment }, { status: 201 });
}
