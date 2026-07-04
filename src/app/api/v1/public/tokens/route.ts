import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";
import { createApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";

export async function GET(request: Request) {
  const { userId, error } = await authenticatePublicApi(request);
  if (error) return error;

  const tokens = await prisma.apiToken.findMany({
    where: { userId, revokedAt: null },
    select: {
      id: true, name: true, prefix: true, scopes: true,
      expiresAt: true, lastUsedAt: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: tokens });
}

export async function POST(request: Request) {
  const { userId, error } = await authenticatePublicApi(request);
  if (error) return error;

  const body = await request.json();
  const { name, scopes, expiresAt } = body as { name?: string; scopes?: string[]; expiresAt?: string | null };

  if (!name || !scopes || !Array.isArray(scopes)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "name and scopes array required" } },
      { status: 400 },
    );
  }

  const { raw, prefix, id } = await createApiToken({
    userId,
    name,
    scopes,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  await logAudit({
    actorUserId: userId,
    action: "api_token_created",
    entityType: "api_token",
    entityId: id,
    after: { name, scopes, expiresAt },
  });

  return NextResponse.json({ data: { raw, prefix, name, scopes } }, { status: 201 });
}
