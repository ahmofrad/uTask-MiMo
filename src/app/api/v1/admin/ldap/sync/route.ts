import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { getLdapConfig, syncAllLdapGroups } from "@/lib/auth/providers/ldap";
import { logAudit } from "@/lib/audit/log";

export async function POST(_request: Request) {
  const authResult = await requireAuth(_request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(_request, { params: {} });
  if (guardResult) return guardResult;

  const config = await getLdapConfig();
  if (!config || !config.enabled) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "LDAP not configured" } },
      { status: 400 },
    );
  }

  const groupCount = await prisma.ldapSyncGroup.count();
  if (groupCount === 0) {
    return NextResponse.json({ data: { groups: 0, users: 0 } });
  }

  const result = await syncAllLdapGroups(config);

  await logAudit({
    actorUserId: userId,
    action: "ldap_sync",
    entityType: "ldapgroup",
    entityId: "all",
    after: result,
  });

  return NextResponse.json({ data: result });
}