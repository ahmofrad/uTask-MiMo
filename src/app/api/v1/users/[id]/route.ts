import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { getUserById } from "@/lib/users";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;

  const user = await getUserById(params.id);

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
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (userId !== params.id) {
    const guard = requirePermission("user:manage");
    const guardResult = await guard(request, { params });
    if (guardResult) return guardResult;
  }

  const body = await request.json();
  const { displayName, locale, accentColor, theme, density } = body as Record<string, string>;

  const updateData: Record<string, unknown> = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (locale !== undefined) updateData.locale = locale;
  if (accentColor !== undefined) updateData.accentColor = accentColor;
  if (theme !== undefined) updateData.theme = theme;
  if (density !== undefined) updateData.density = density;

  const before = await prisma.user.findUnique({ where: { id: params.id } });

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, email: true, displayName: true, locale: true, accentColor: true, theme: true, density: true },
  });

  await logAudit({ actorUserId: userId, action: "user_updated", entityType: "user", entityId: params.id, before: before as never, after: user as never });

  return NextResponse.json({ data: user });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(_request, { params });
  if (guardResult) return guardResult;

  const before = await prisma.user.findUnique({ where: { id: params.id } });

  await prisma.user.update({
    where: { id: params.id },
    data: { status: "suspended" },
  });

  await logAudit({ actorUserId: userId, action: "user_suspended", entityType: "user", entityId: params.id, before: before as never });

  return NextResponse.json({ data: { success: true } });
}