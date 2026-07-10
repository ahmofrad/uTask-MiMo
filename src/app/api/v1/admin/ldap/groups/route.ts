import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getLdapConfig, searchLdapGroups } from "@/lib/auth/providers/ldap";
import { logAudit } from "@/lib/audit/log";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const permitted = await can(session.user.id, "sso:configure");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";

  // No query → list the already-selected sync groups (always available, even if LDAP is off).
  if (!q.trim()) {
    const groups = await prisma.ldapSyncGroup.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ data: groups });
  }

  const config = await getLdapConfig();
  if (!config || !config.enabled) {
    return NextResponse.json({ data: [] });
  }

  const groups = await searchLdapGroups(config, q.trim());
  return NextResponse.json({ data: groups });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const permitted = await can(session.user.id, "sso:configure");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { dn, name } = body as { dn?: string; name?: string };
  if (!dn || !name) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "dn and name are required" } },
      { status: 400 },
    );
  }

  const group = await prisma.ldapSyncGroup.upsert({
    where: { dn },
    create: { dn, name },
    update: { name },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "ldap_group_added",
    entityType: "ldapgroup",
    entityId: group.id,
    after: { dn, name },
  });

  return NextResponse.json({ data: group });
}
