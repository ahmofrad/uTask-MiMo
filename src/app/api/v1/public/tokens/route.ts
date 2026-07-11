import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";
import { createApiToken, invalidScopes, normalizeScopes, userCanGrantScope, PUBLIC_SCOPES } from "@/lib/api-token";
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
  const { name, scopes, expiresAt } = body as { name?: string; scopes?: unknown; expiresAt?: string | null };

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "name is required" } },
      { status: 400 },
    );
  }

  const normalized = normalizeScopes(scopes);
  if (!normalized || normalized.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "a non-empty scopes array is required" } },
      { status: 400 },
    );
  }

  const bad = invalidScopes(normalized);
  if (bad.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_SCOPE",
          message: `Unknown scope(s): ${bad.join(", ")}. Allowed: ${PUBLIC_SCOPES.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  for (const scope of normalized) {
    if (!(await userCanGrantScope(userId, scope))) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: `You are not allowed to grant the scope: ${scope}` } },
        { status: 403 },
      );
    }
  }

  const { raw, prefix, id } = await createApiToken({
    userId,
    name,
    scopes: normalized,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  await logAudit({
    actorUserId: userId,
    action: "api_token_created",
    entityType: "api_token",
    entityId: id,
    after: { name, scopes: normalized, expiresAt },
  });

  return NextResponse.json({ data: { raw, prefix, name, scopes: normalized } }, { status: 201 });
}
