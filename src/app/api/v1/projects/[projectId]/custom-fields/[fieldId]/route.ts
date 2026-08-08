import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { UpdateCustomFieldSchema } from "@/lib/custom-fields/schemas";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody } from "@/lib/validation/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; fieldId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "custom_field:define", resolvedParams.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await readJsonBody(request);
  const parsed = UpdateCustomFieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 },
    );
  }

  const before = await prisma.customField.findUnique({ where: { id: resolvedParams.fieldId } });
  if (!before || before.projectId !== resolvedParams.projectId || before.archivedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

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

  if (!(await canProject(userId, "custom_field:define", resolvedParams.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const before = await prisma.customField.findUnique({ where: { id: resolvedParams.fieldId } });
  if (!before || before.projectId !== resolvedParams.projectId || before.archivedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  await prisma.customField.update({
    where: { id: resolvedParams.fieldId, projectId: resolvedParams.projectId },
    data: { archivedAt: new Date() },
  });

  await logAudit({ actorUserId: userId, action: "custom_field_archived", entityType: "customField", entityId: resolvedParams.fieldId, before: before as never });

  return NextResponse.json({ data: { success: true } });
}
