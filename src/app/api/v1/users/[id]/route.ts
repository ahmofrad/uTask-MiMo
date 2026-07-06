import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { getUserById } from "@/lib/users";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  if (session.user.id !== params.id) {
    const permitted = await can(session.user.id, "user:manage");
    if (!permitted) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }
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

  await logAudit({ actorUserId: session.user.id, action: "user_updated", entityType: "user", entityId: params.id, before: before as never, after: user as never });

  return NextResponse.json({ data: user });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "user:manage");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const before = await prisma.user.findUnique({ where: { id: params.id } });

  await prisma.user.update({
    where: { id: params.id },
    data: { status: "suspended" },
  });

  await logAudit({ actorUserId: session.user.id, action: "user_suspended", entityType: "user", entityId: params.id, before: before as never });

  return NextResponse.json({ data: { success: true } });
}
