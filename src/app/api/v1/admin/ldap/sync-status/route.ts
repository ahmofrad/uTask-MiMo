import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  if (!(await can(authResult.userId, "sso:configure"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  // Get all LDAP sources
  const sources = await prisma.ldapSource.findMany({
    select: {
      id: true,
      name: true,
      enabled: true,
      lastSyncedAt: true,
      lastSyncError: true,
      syncIntervalHours: true,
    },
  });

  // Get sync group stats per source
  const sourceIds = sources.map((s) => s.id);
  const groups = await prisma.ldapSyncGroup.findMany({
    where: { sourceId: { in: sourceIds }, deletedAt: null },
    select: {
      id: true,
      sourceId: true,
      name: true,
      lastSyncedAt: true,
      _count: { select: { memberships: true } },
    },
  });

  // Get total membership count per source
  const groupIds = groups.map((g) => g.id);
  const totalMembers = groupIds.length > 0
    ? await prisma.ldapGroupMembership.count({
        where: { ldapSyncGroupId: { in: groupIds } },
      })
    : 0;

  // Get distinct users synced from LDAP
  const distinctLdapUsers = groupIds.length > 0
    ? await prisma.ldapGroupMembership.findMany({
        where: { ldapSyncGroupId: { in: groupIds } },
        select: { userId: true },
        distinct: ["userId"],
      })
    : [];

  // Aggregate stats per source
  const sourceStats = sources.map((source) => {
    const sourceGroups = groups.filter((g) => g.sourceId === source.id);
    const groupMemberCounts = sourceGroups.reduce((sum, g) => sum + g._count.memberships, 0);
    const latestGroupSync = sourceGroups
      .map((g) => g.lastSyncedAt)
      .filter(Boolean)
      .sort((a, b) => (b!.getTime() - a!.getTime()))[0] ?? null;

    return {
      id: source.id,
      name: source.name,
      enabled: source.enabled,
      lastSyncedAt: source.lastSyncedAt?.toISOString() ?? latestGroupSync?.toISOString() ?? null,
      lastSyncError: source.lastSyncError,
      syncIntervalHours: source.syncIntervalHours,
      groupCount: sourceGroups.length,
      memberCount: groupMemberCounts,
      groups: sourceGroups.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g._count.memberships,
        lastSyncedAt: g.lastSyncedAt?.toISOString() ?? null,
      })),
    };
  });

  return NextResponse.json({
    data: {
      sources: sourceStats,
      totalGroups: groups.length,
      totalMembers,
      totalDistinctUsers: distinctLdapUsers.length,
    },
  });
}
