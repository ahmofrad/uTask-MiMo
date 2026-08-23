import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { createApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";
import { publicTokenCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const tokens = await prisma.apiToken.findMany({
    where: { userId, organizationId },
    select: {
      id: true, name: true, prefix: true, scopes: true,
      expiresAt: true, lastUsedAt: true, createdAt: true, revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: tokens });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const parsed = publicTokenCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, scopes, expiresAt } = parsed.data;

  const { raw, prefix, id } = await createApiToken({
    userId,
    organizationId,
    name,
    scopes,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  await logAudit({
    organizationId,
    actorUserId: userId,
    action: "api_token_created",
    entityType: "api_token",
    entityId: id,
    after: { name, scopes, expiresAt },
  });

  return NextResponse.json({ data: { raw, prefix, name, scopes, id } }, { status: 201 });
}