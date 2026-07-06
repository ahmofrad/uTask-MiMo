import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { createApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id },
    select: {
      id: true, name: true, prefix: true, scopes: true,
      expiresAt: true, lastUsedAt: true, createdAt: true, revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: tokens });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const body = await request.json();
  const { name, scopes, expiresAt } = body as { name?: string; scopes?: string[]; expiresAt?: string | null };

  if (!name || !scopes || !Array.isArray(scopes)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "name and scopes array required" } },
      { status: 400 },
    );
  }

  const { raw, prefix, id } = await createApiToken({
    userId: session.user.id,
    name,
    scopes,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "api_token_created",
    entityType: "api_token",
    entityId: id,
    after: { name, scopes, expiresAt },
  });

  return NextResponse.json({ data: { raw, prefix, name, scopes, id } }, { status: 201 });
}
