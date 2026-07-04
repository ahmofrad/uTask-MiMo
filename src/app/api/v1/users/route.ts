import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import type { AuditAction } from "@prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "user:manage");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const status = searchParams.get("status");
  const roleFilter = searchParams.get("role");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (roleFilter) {
    where.roles = { some: { type: roleFilter, scopeType: "global" } };
  }

  const users = await prisma.user.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      locale: true,
      accentColor: true,
      theme: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      roles: {
        where: { scopeType: "global" },
        select: { type: true },
      },
    },
  });

  const hasMore = users.length > limit;
  if (hasMore) users.pop();
  const lastItem = users[users.length - 1];

  return NextResponse.json({
    data: users,
    meta: {
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      hasMore,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "user:manage");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

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

  const passwordHash = password ? await bcrypt.hash(password, 12) : null;

  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      status: password ? "active" : "invited",
    },
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

  await logAudit({ actorUserId: session.user.id, action: "created" as AuditAction, entityType: "user", entityId: user.id, after: { email: user.email, displayName: user.displayName, status: user.status } as never });

  return NextResponse.json(
    { data: { id: user.id, email: user.email, displayName: user.displayName, status: user.status } },
    { status: 201 },
  );
}
