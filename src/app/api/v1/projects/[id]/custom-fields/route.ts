import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { CreateCustomFieldSchema } from "@/lib/custom-fields/schemas";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const fields = await prisma.customField.findMany({
    where: { projectId: params.id, archivedAt: null },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json({ data: fields });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
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
  const parsed = CreateCustomFieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
      { status: 400 },
    );
  }

  const { name, key, type, required, orderIndex, configJson } = parsed.data;

  const existing = await prisma.customField.findFirst({
    where: { projectId: params.id, key },
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: `Field with key "${key}" already exists in this project` } },
      { status: 409 },
    );
  }

  const maxOrder = await prisma.customField.aggregate({
    where: { projectId: params.id },
    _max: { orderIndex: true },
  });

  const field = await prisma.customField.create({
    data: {
      projectId: params.id,
      name,
      key,
      type: type as never,
      required,
      orderIndex: orderIndex ?? (maxOrder._max.orderIndex ?? -1) + 1,
      configJson: configJson as never,
    },
  });

  await logAudit({ actorUserId: session.user.id, action: "custom_field_created", entityType: "customField", entityId: field.id, after: field as never });

  return NextResponse.json({ data: field }, { status: 201 });
}
