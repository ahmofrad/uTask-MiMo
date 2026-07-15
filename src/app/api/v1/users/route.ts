import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { listUsers, createUser } from "@/lib/users";
import { prisma } from "@/lib/db";
import type { AuditAction } from "@prisma/client";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const result = await listUsers({
    ...(searchParams.get("cursor") ? { cursor: searchParams.get("cursor")! } : {}),
    limit,
    ...(searchParams.get("status") ? { status: searchParams.get("status")! } : {}),
    ...(searchParams.get("role") ? { role: searchParams.get("role")! } : {}),
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { email, displayName, password, role } = body as {
    email?: string;
    displayName?: string;
    password?: string;
    role?: string;
  };

  if (!email || !displayName) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Email and displayName are required" } },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Email already in use" } },
      { status: 409 },
    );
  }

  const user = await createUser({
    email,
    displayName,
    ...(password ? { password } : {}),
  });

  if (role) {
    await prisma.role.create({
      data: {
        userId: user.id,
        type: role as never,
        scopeType: "global",
        scopeId: null,
        grantedBy: "system",
      },
    });
  }

  await logAudit({ actorUserId: userId, action: "created" as AuditAction, entityType: "user", entityId: user.id, after: { email: user.email, displayName: user.displayName, status: user.status } as never });

  return NextResponse.json(
    { data: { id: user.id, email: user.email, displayName: user.displayName, status: user.status } },
    { status: 201 },
  );
}