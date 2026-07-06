import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { updateSettings, getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit/log";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "sso:configure");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const ldap = await getSettings("install", "ldap");
  const saml = await getSettings("install", "saml");

  return NextResponse.json({ data: { ldap, saml } });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "sso:configure");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { ldap, saml } = body as { ldap?: Record<string, unknown>; saml?: Record<string, unknown> };

  // Fetch current values for audit before/after
  const beforeLdap = await getSettings("install", "ldap");
  const beforeSaml = await getSettings("install", "saml");

  if (ldap && typeof ldap === "object") {
    // Don't save empty password field
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ldap)) {
      if (v !== "" && v !== undefined && v !== null) {
        filtered[k] = v;
      }
    }
    if (Object.keys(filtered).length > 0) {
      await updateSettings("install", "ldap", filtered);
    }
  }

  if (saml && typeof saml === "object") {
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(saml)) {
      if (v !== "" && v !== undefined && v !== null) {
        filtered[k] = v;
      }
    }
    if (Object.keys(filtered).length > 0) {
      await updateSettings("install", "saml", filtered);
    }
  }

  const afterLdap = await getSettings("install", "ldap");
  const afterSaml = await getSettings("install", "saml");

  await logAudit({
    actorUserId: session.user.id,
    action: "updated",
    entityType: "settings",
    entityId: "sso",
    before: { ldap: beforeLdap, saml: beforeSaml },
    after: { ldap: afterLdap, saml: afterSaml },
  });

  return NextResponse.json({ data: { success: true } });
}
