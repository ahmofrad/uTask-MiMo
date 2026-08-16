import { prisma } from "@/lib/db";
import type { LdapSource } from "@prisma/client";
import { decryptSecret } from "@/lib/webhook";
import { ldapConfigSchema, type LdapConfig } from "./ldap-schema";

/**
 * Config layer for Active Directory sources. A source is one row in the
 * `LdapSource` table; the `bindPassword` column is encrypted at rest
 * (`iv:ciphertext:tag`, AES-256-GCM). Decryption happens here, once, when a
 * row is mapped to the `LdapConfig` shape consumed by auth / sync / test /
 * group search.
 */

export async function listLdapSources(): Promise<LdapSource[]> {
  return prisma.ldapSource.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function getLdapSource(id: string): Promise<LdapSource | null> {
  return prisma.ldapSource.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function getEnabledLdapSources(): Promise<LdapSource[]> {
  return prisma.ldapSource.findMany({
    where: { deletedAt: null, enabled: true },
    orderBy: { createdAt: "asc" },
  });
}

/** First non-deleted source regardless of enabled state (admin display). */
export async function getFirstLdapSource(): Promise<LdapSource | null> {
  return prisma.ldapSource.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

/** First enabled source — the single-source compatibility path. */
export async function getFirstEnabledLdapSource(): Promise<LdapSource | null> {
  const sources = await getEnabledLdapSources();
  return sources[0] ?? null;
}

/** Map a stored source row to the runtime `LdapConfig` shape (decrypted). */
export function sourceToLdapConfig(source: LdapSource): LdapConfig {
  return ldapConfigSchema.parse({
    enabled: source.enabled,
    url: source.url,
    bindUpn: source.bindUpn,
    bindPassword: decryptSecret(source.bindPassword),
    upnSuffix: source.upnSuffix ?? undefined,
    searchBase: source.searchBase ?? undefined,
    emailAttribute: source.emailAttribute,
    nameAttribute: source.nameAttribute,
    defaultRole: source.defaultRole,
    syncIntervalHours: source.syncIntervalHours,
    tlsCaCert: source.tlsCaCert ?? undefined,
  });
}

/** Never leak the stored password — expose only whether one is set. */
export function redactLdapSource(source: LdapSource): Record<string, unknown> {
  return {
    id: source.id,
    name: source.name,
    enabled: source.enabled,
    url: source.url,
    bindUpn: source.bindUpn,
    bindPasswordConfigured: source.bindPassword.length > 0,
    upnSuffix: source.upnSuffix ?? "",
    searchBase: source.searchBase ?? "",
    emailAttribute: source.emailAttribute,
    nameAttribute: source.nameAttribute,
    defaultRole: source.defaultRole,
    syncIntervalHours: source.syncIntervalHours,
    tlsCaCert: source.tlsCaCert ?? "",
    lastSyncedAt: source.lastSyncedAt,
    lastSyncError: source.lastSyncError,
  };
}

/** Derive a display name for a new source (mirrors the migration logic). */
export function deriveLdapSourceName(input: {
  upnSuffix?: string | null;
  bindUpn?: string | null;
  url?: string | null;
}): string {
  const upnSuffix = input.upnSuffix?.replace(/^@/, "").trim();
  if (upnSuffix) return upnSuffix;
  const bindDomain = input.bindUpn?.split("@")[1]?.trim();
  if (bindDomain) return bindDomain;
  try {
    const host = input.url ? new URL(input.url).hostname : "";
    if (host) return host;
  } catch {
    // fall through
  }
  return "Active Directory";
}
