import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac/middleware";
import { problemResponse } from "@/lib/api/problem";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody } from "@/lib/validation/api";
import { z } from "zod";

const organizationCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: authResult.userId },
    orderBy: { createdAt: "asc" },
    select: {
      organizationId: true,
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
  return NextResponse.json({ data: memberships });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const parsed = organizationCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return problemResponse(request, 400, "VALIDATION_ERROR", "Invalid organization payload");

  const existing = await prisma.organization.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
  if (existing) return problemResponse(request, 409, "CONFLICT", "Organization slug is already in use");

  const organization = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({ data: parsed.data });
    await tx.organizationMembership.create({
      data: { organizationId: created.id, userId: authResult.userId, role: "owner" },
    });
    await tx.role.create({
      data: {
        organizationId: created.id,
        userId: authResult.userId,
        type: "owner",
        scopeType: "global",
        scopeId: null,
        grantedBy: authResult.userId,
      },
    });
    return created;
  });

  await logAudit({
    organizationId: organization.id,
    actorUserId: authResult.userId,
    action: "created",
    entityType: "organization",
    entityId: organization.id,
    after: { name: organization.name, slug: organization.slug },
  });
  return NextResponse.json({ data: organization }, { status: 201 });
}
