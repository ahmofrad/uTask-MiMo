import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getLdapConfig, syncAllLdapGroups } from "@/lib/auth/providers/ldap";
import { logAudit } from "@/lib/audit/log";

export async function POST(_request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const permitted = await can(session.user.id, "sso:configure");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

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
    actorUserId: session.user.id,
    action: "ldap_sync",
    entityType: "ldapgroup",
    entityId: "all",
    after: result,
  });

  return NextResponse.json({ data: result });
}
