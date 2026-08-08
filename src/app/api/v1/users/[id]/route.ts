import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { getUserById, suspendUser } from "@/lib/users";
import { readJsonBody, userUpdateSchema, validationError } from "@/lib/validation/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = authResult;
  if (userId !== resolvedParams.id && !(await can(userId, "user:manage"))) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 });
  }

  const user = await getUserById(resolvedParams.id);

  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: user });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (userId !== resolvedParams.id) {
    const guard = requirePermission("user:manage");
    const guardResult = await guard(request, { params: resolvedParams });
    if (guardResult) return guardResult;
  }

  const parsed = userUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { displayName, locale, accentColor, theme, density } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (locale !== undefined) updateData.locale = locale;
  if (accentColor !== undefined) updateData.accentColor = accentColor;
  if (theme !== undefined) updateData.theme = theme;
  if (density !== undefined) updateData.density = density;

  const before = await prisma.user.findUnique({ where: { id: resolvedParams.id } });

  const user = await prisma.user.update({
    where: { id: resolvedParams.id },
    data: updateData,
    select: { id: true, email: true, displayName: true, locale: true, accentColor: true, theme: true, density: true },
  });

  await logAudit({ actorUserId: userId, action: "user_updated", entityType: "user", entityId: resolvedParams.id, before: before as never, after: user as never });

  return NextResponse.json({ data: user });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const before = await prisma.user.findUnique({ where: { id: resolvedParams.id } });

  await suspendUser(resolvedParams.id);

  await logAudit({ actorUserId: userId, action: "user_suspended", entityType: "user", entityId: resolvedParams.id, before: before as never });

  return NextResponse.json({ data: { success: true } });
}