import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { problemResponse } from "@/lib/api/problem";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody } from "@/lib/validation/api";
import { z } from "zod";

const paramsSchema = z.object({ organizationId: z.string().uuid() });
const membershipSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
}).strict();

async function authorize(request: Request, organizationId: string) {
  const permissionGuard = requirePermission("org:manage");
  const permissionResult = await permissionGuard(request, { params: { organizationId } });
  if (permissionResult) return permissionResult;
  const authResult = await requireAuth(request, { params: { organizationId } });
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.organizationId !== organizationId || !(await can(authResult.userId, "org:manage", organizationId))) {
    return problemResponse(request, 403, "FORBIDDEN", "Only organization owners can manage membership");
  }
  return authResult;
}

export async function GET(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const resolved = await params;
  const parsedParams = paramsSchema.safeParse(resolved);
  if (!parsedParams.success) return problemResponse(request, 400, "VALIDATION_ERROR", "Invalid organization ID");
  const authResult = await requireAuth(request, { params: resolved });
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.organizationId !== resolved.organizationId) return problemResponse(request, 403, "FORBIDDEN", "Organization access denied");

  const members = await prisma.organizationMembership.findMany({
    where: { organizationId: resolved.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      organizationId: true,
      userId: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, displayName: true, status: true } },
    },
  });
  return NextResponse.json({ data: members });
}

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const resolved = await params;
  const authCheck = await requireAuth(request, { params: resolved });
  if (authCheck instanceof NextResponse) return authCheck;
  const permissionGuard = requirePermission("org:manage");
  const permissionCheck = await permissionGuard(request, { params: resolved });
  if (permissionCheck) return permissionCheck;
  const parsedParams = paramsSchema.safeParse(resolved);
  if (!parsedParams.success) return problemResponse(request, 400, "VALIDATION_ERROR", "Invalid organization ID");
  const authResult = await authorize(request, resolved.organizationId);
  if (authResult instanceof NextResponse) return authResult;

  const parsed = membershipSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return problemResponse(request, 400, "VALIDATION_ERROR", "Invalid membership payload");
  const target = await prisma.user.findFirst({ where: { id: parsed.data.userId, status: { not: "suspended" } }, select: { id: true } });
  if (!target) return problemResponse(request, 404, "NOT_FOUND", "User not found");

  const membership = await prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId: resolved.organizationId, userId: target.id } },
    create: { organizationId: resolved.organizationId, userId: target.id, role: parsed.data.role },
    update: { role: parsed.data.role },
    select: { organizationId: true, userId: true, role: true, createdAt: true },
  });
  await logAudit({ organizationId: resolved.organizationId, actorUserId: authResult.userId, action: "updated", entityType: "organization_membership", entityId: `${resolved.organizationId}:${target.id}`, after: membership as never });
  return NextResponse.json({ data: membership }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const resolved = await params;
  const authCheck = await requireAuth(request, { params: resolved });
  if (authCheck instanceof NextResponse) return authCheck;
  const permissionGuard = requirePermission("org:manage");
  const permissionCheck = await permissionGuard(request, { params: resolved });
  if (permissionCheck) return permissionCheck;
  const parsedParams = paramsSchema.safeParse(resolved);
  if (!parsedParams.success) return problemResponse(request, 400, "VALIDATION_ERROR", "Invalid organization ID");
  const authResult = await authorize(request, resolved.organizationId);
  if (authResult instanceof NextResponse) return authResult;

  const body = await readJsonBody(request);
  const parsed = z.object({ userId: z.string().uuid() }).strict().safeParse(body);
  if (!parsed.success) return problemResponse(request, 400, "VALIDATION_ERROR", "Invalid membership payload");
  if (parsed.data.userId === authResult.userId) return problemResponse(request, 409, "CONFLICT", "You cannot remove yourself from the organization");

  const deleted = await prisma.organizationMembership.deleteMany({ where: { organizationId: resolved.organizationId, userId: parsed.data.userId } });
  if (deleted.count !== 1) return problemResponse(request, 404, "NOT_FOUND", "Organization member not found");
  await prisma.role.deleteMany({ where: { organizationId: resolved.organizationId, userId: parsed.data.userId } });
  await logAudit({ organizationId: resolved.organizationId, actorUserId: authResult.userId, action: "deleted", entityType: "organization_membership", entityId: `${resolved.organizationId}:${parsed.data.userId}`, after: { removedUserId: parsed.data.userId } });
  return NextResponse.json({ data: { success: true } });
}
