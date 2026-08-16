import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const group = await prisma.ldapSyncGroup.findUnique({
    where: { id: resolvedParams.id },
    select: { id: true, deletedAt: true },
  });
  if (!group || group.deletedAt) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, { status: 404 });
  }

  const memberships = await prisma.ldapGroupMembership.findMany({
    where: { ldapSyncGroupId: group.id },
    select: {
      user: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { user: { displayName: "asc" } },
  });

  const members = memberships.map((membership) => membership.user);
  return NextResponse.json({ data: members });
}
