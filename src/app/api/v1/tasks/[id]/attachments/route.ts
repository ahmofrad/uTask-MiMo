import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import type { AuditAction } from "@prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
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

  const storageKey = `tasks/${params.id}/${crypto.randomUUID()}-${file.name}`;

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
