import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import {
  listDepartmentMembers,
  addDepartmentMember,
  removeDepartmentMember,
} from "@/lib/departments";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const members = await listDepartmentMembers(resolvedParams.id);
  return NextResponse.json({ data: members });
}

const memberSchema = z.object({ userId: z.string().uuid() }).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const parsed = memberSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const candidate = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      status: "active",
      roles: { none: { type: "guest", scopeType: "global" } },
    },
    select: { id: true },
  });
  if (!candidate) {
    return NextResponse.json(
      { error: { code: "INVALID_MEMBER", message: "Only active local users can join a department" } },
      { status: 400 },
    );
  }

  const result = await addDepartmentMember(resolvedParams.id, parsed.data.userId);
  if (!result.created) {
    return NextResponse.json({ data: result }, { status: 200 });
  }
  await logAudit({
    actorUserId: userId,
    action: "department_member_added",
    entityType: "department",
    entityId: resolvedParams.id,
    after: { userId: parsed.data.userId },
  });
  return NextResponse.json({ data: { success: true, created: true } }, { status: 201 });
}

const deleteMemberSchema = z.object({ userId: z.string().uuid() }).strict();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const parsed = deleteMemberSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  await removeDepartmentMember(resolvedParams.id, parsed.data.userId);
  await logAudit({
    actorUserId: userId,
    action: "department_member_removed",
    entityType: "department",
    entityId: resolvedParams.id,
    after: { userId: parsed.data.userId },
  });
  return NextResponse.json({ data: { success: true } });
}
