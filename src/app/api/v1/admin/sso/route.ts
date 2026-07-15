import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { updateSettings, getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit/log";
import { encrypt } from "@/lib/crypto/encrypt";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const allSettings = await getSettings("install", null);
  const ldap = (allSettings.ldap ?? {}) as Record<string, unknown>;
  const saml = (allSettings.saml ?? {}) as Record<string, unknown>;

  return NextResponse.json({ data: { ldap, saml } });
}

export async function PATCH(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { ldap, saml } = body as { ldap?: Record<string, unknown>; saml?: Record<string, unknown> };

  // Fetch current values for audit before/after
  const allBefore = await getSettings("install", null);
  const beforeLdap = (allBefore.ldap ?? {}) as Record<string, unknown>;
  const beforeSaml = (allBefore.saml ?? {}) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};

  if (ldap && typeof ldap === "object") {
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ldap)) {
      if (v !== "" && v !== undefined && v !== null) {
        filtered[k] = v;
      }
    }
    // Encrypt bindPassword if provided and not already encrypted
    if (typeof filtered.bindPassword === "string" && !filtered.bindPassword.includes(":")) {
      const enc = encrypt(filtered.bindPassword);
      filtered.bindPassword = `${enc.iv}:${enc.ciphertext}:${enc.tag}`;
    }
    if (Object.keys(filtered).length > 0) {
      updates.ldap = filtered;
    }
  }

  if (saml && typeof saml === "object") {
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(saml)) {
      if (v !== "" && v !== undefined && v !== null) {
        filtered[k] = v;
      }
    }
    // Encrypt idpCertificate if provided and not already encrypted
    if (typeof filtered.idpCertificate === "string" && !filtered.idpCertificate.includes(":")) {
      const enc = encrypt(filtered.idpCertificate);
      filtered.idpCertificate = `${enc.iv}:${enc.ciphertext}:${enc.tag}`;
    }
    if (Object.keys(filtered).length > 0) {
      updates.saml = filtered;
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateSettings("install", null, updates);
  }

  const allAfter = await getSettings("install", null);
  const afterLdap = (allAfter.ldap ?? {}) as Record<string, unknown>;
  const afterSaml = (allAfter.saml ?? {}) as Record<string, unknown>;

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "settings",
    entityId: "sso",
    before: { ldap: beforeLdap, saml: beforeSaml },
    after: { ldap: afterLdap, saml: afterSaml },
  });

  return NextResponse.json({ data: { success: true } });
}