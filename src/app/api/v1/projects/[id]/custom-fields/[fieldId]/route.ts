import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { UpdateCustomFieldSchema } from "@/lib/custom-fields/schemas";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; fieldId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "custom_field:define");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const parsed = UpdateCustomFieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 },
    );
  }

  const before = await prisma.customField.findUnique({ where: { id: params.fieldId } });

  const field = await prisma.customField.update({
    where: { id: params.fieldId, projectId: params.id },
    data: parsed.data as never,
  });

  await logAudit({ actorUserId: session.user.id, action: "custom_field_updated", entityType: "customField", entityId: params.fieldId, before: before as never, after: field as never });

  return NextResponse.json({ data: field });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; fieldId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "custom_field:define");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const before = await prisma.customField.findUnique({ where: { id: params.fieldId } });

  await prisma.customField.update({
    where: { id: params.fieldId, projectId: params.id },
    data: { archivedAt: new Date() },
  });

  await logAudit({ actorUserId: session.user.id, action: "custom_field_archived", entityType: "customField", entityId: params.fieldId, before: before as never });

  return NextResponse.json({ data: { success: true } });
}
