import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { UpdateCustomFieldSchema } from "@/lib/custom-fields/schemas";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; fieldId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("custom_field:define");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const body = await request.json();
  const parsed = UpdateCustomFieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 },
    );
  }

  const before = await prisma.customField.findUnique({ where: { id: resolvedParams.fieldId } });

  const field = await prisma.customField.update({
    where: { id: resolvedParams.fieldId, projectId: resolvedParams.projectId },
    data: parsed.data as never,
  });

  await logAudit({ actorUserId: userId, action: "custom_field_updated", entityType: "customField", entityId: resolvedParams.fieldId, before: before as never, after: field as never });

  return NextResponse.json({ data: field });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; fieldId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("custom_field:define");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const before = await prisma.customField.findUnique({ where: { id: resolvedParams.fieldId } });

  await prisma.customField.update({
    where: { id: resolvedParams.fieldId, projectId: resolvedParams.projectId },
    data: { archivedAt: new Date() },
  });

  await logAudit({ actorUserId: userId, action: "custom_field_archived", entityType: "customField", entityId: resolvedParams.fieldId, before: before as never });

  return NextResponse.json({ data: { success: true } });
}