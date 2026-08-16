import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { updateSettings, getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit/log";
import { encrypt } from "@/lib/crypto/encrypt";
import { deriveLdapSourceName, getFirstLdapSource, redactLdapSource } from "@/lib/auth/ldap-sources";
import { readJsonBody, ssoSettingsUpdateSchema, validationError } from "@/lib/validation/api";

const SENSITIVE_SAML_KEYS = new Set(["idpCertificate"]);

function redactSamlSettings(value: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_SAML_KEYS.has(key)) {
      safe[`${key}Configured`] = typeof entry === "string" && entry.length > 0;
    } else {
      safe[key] = entry;
    }
  }
  return safe;
}

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const source = await getFirstLdapSource();
  const ldap = source ? redactLdapSource(source) : {};
  const allSettings = await getSettings("install", null);
  const saml = redactSamlSettings((allSettings.saml ?? {}) as Record<string, unknown>);

  return NextResponse.json({ data: { ldap, saml } });
}

export async function PATCH(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = ssoSettingsUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { ldap, saml } = parsed.data;

  // LDAP config now lives in the LdapSource table (one row per directory); the
  // legacy settings blob is no longer read or written by this route.
  const beforeSource = await getFirstLdapSource();
  const beforeLdap = beforeSource ? redactLdapSource(beforeSource) : {};

  const allBefore = await getSettings("install", null);
  const beforeSaml = redactSamlSettings((allBefore.saml ?? {}) as Record<string, unknown>);

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
      const existing = await prisma.ldapSource.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (existing) {
        await prisma.ldapSource.update({
          where: { id: existing.id },
          data: {
            ...(typeof filtered.enabled === "boolean" ? { enabled: filtered.enabled } : {}),
            ...(typeof filtered.url === "string" ? { url: filtered.url } : {}),
            ...(typeof filtered.bindUpn === "string" ? { bindUpn: filtered.bindUpn } : {}),
            ...(typeof filtered.bindPassword === "string" ? { bindPassword: filtered.bindPassword } : {}),
            ...(typeof filtered.upnSuffix === "string" ? { upnSuffix: filtered.upnSuffix } : {}),
            ...(typeof filtered.searchBase === "string" ? { searchBase: filtered.searchBase } : {}),
            ...(typeof filtered.emailAttribute === "string" ? { emailAttribute: filtered.emailAttribute } : {}),
            ...(typeof filtered.nameAttribute === "string" ? { nameAttribute: filtered.nameAttribute } : {}),
            ...(typeof filtered.defaultRole === "string" ? { defaultRole: filtered.defaultRole } : {}),
            ...(typeof filtered.syncIntervalHours === "number" ? { syncIntervalHours: filtered.syncIntervalHours } : {}),
            ...(typeof filtered.tlsCaCert === "string" ? { tlsCaCert: filtered.tlsCaCert } : {}),
          },
        });
      } else {
        await prisma.ldapSource.create({
          data: {
            name: deriveLdapSourceName({
              ...(typeof filtered.upnSuffix === "string" ? { upnSuffix: filtered.upnSuffix as string } : {}),
              ...(typeof filtered.bindUpn === "string" ? { bindUpn: filtered.bindUpn as string } : {}),
              ...(typeof filtered.url === "string" ? { url: filtered.url as string } : {}),
            }),
            enabled: typeof filtered.enabled === "boolean" ? filtered.enabled : false,
            url: typeof filtered.url === "string" ? filtered.url : "",
            bindUpn: typeof filtered.bindUpn === "string" ? filtered.bindUpn : "",
            bindPassword: typeof filtered.bindPassword === "string" ? filtered.bindPassword : "",
            upnSuffix: typeof filtered.upnSuffix === "string" ? filtered.upnSuffix : null,
            searchBase: typeof filtered.searchBase === "string" ? filtered.searchBase : null,
            emailAttribute: typeof filtered.emailAttribute === "string" ? filtered.emailAttribute : "mail",
            nameAttribute: typeof filtered.nameAttribute === "string" ? filtered.nameAttribute : "cn",
            defaultRole: typeof filtered.defaultRole === "string" ? filtered.defaultRole : "member",
            syncIntervalHours: typeof filtered.syncIntervalHours === "number" ? filtered.syncIntervalHours : 12,
            tlsCaCert: typeof filtered.tlsCaCert === "string" ? filtered.tlsCaCert : null,
          },
        });
      }
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

  const afterSource = await getFirstLdapSource();
  const afterLdap = afterSource ? redactLdapSource(afterSource) : {};

  const allAfter = await getSettings("install", null);
  const afterSaml = redactSamlSettings((allAfter.saml ?? {}) as Record<string, unknown>);

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