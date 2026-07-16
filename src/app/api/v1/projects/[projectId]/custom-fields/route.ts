import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { CreateCustomFieldSchema } from "@/lib/custom-fields/schemas";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const fields = await prisma.customField.findMany({
    where: { projectId: resolvedParams.projectId, archivedAt: null },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json({ data: fields });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("custom_field:define");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const body = await request.json();
  const parsed = CreateCustomFieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 },
    );
  }

  const { name, key, type, required, orderIndex, configJson } = parsed.data;

  const existing = await prisma.customField.findFirst({
    where: { projectId: resolvedParams.projectId, key },
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: `Field with key "${key}" already exists in this project` } },
      { status: 409 },
    );
  }

  const maxOrder = await prisma.customField.aggregate({
    where: { projectId: resolvedParams.projectId },
    _max: { orderIndex: true },
  });

  const field = await prisma.customField.create({
    data: {
      projectId: resolvedParams.projectId,
      name,
      key,
      type: type as never,
      required,
      orderIndex: orderIndex ?? (maxOrder._max.orderIndex ?? -1) + 1,
      configJson: configJson as never,
    },
  });

  await logAudit({ actorUserId: userId, action: "custom_field_created", entityType: "customField", entityId: field.id, after: field as never });

  return NextResponse.json({ data: field }, { status: 201 });
}