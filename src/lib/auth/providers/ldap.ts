import { Client } from "ldapts";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logging";
import { ldapConfigSchema, type LdapConfig } from "../ldap-schema";
import { getEnabledLdapSources, getFirstEnabledLdapSource, getLdapSource, sourceToLdapConfig } from "../ldap-sources";
import { decryptSecret } from "@/lib/webhook";
import { bindAdmin } from "./ldap-helpers";

// Re-export sync functions
export { syncLdapGroup, syncLdapSource, syncAllLdapSources } from "./ldap-sync";

interface LdapAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    displayName: string;
  };
  error?: string;
}

interface LdapGroupSuggestion {
  dn: string;
  name: string;
}

function attr(entry: Record<string, unknown>, key: string): string | null {
  const v = entry[key];
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : null;
  return typeof v === "string" ? v : null;
}

function domainDn(upn: string): string {
  const domain = upn.includes("@") ? upn.split("@")[1]! : upn;
  return domain
    .split(".")
    .filter(Boolean)
    .map((p) => `dc=${p}`)
    .join(",");
}

export async function getLdapConfig(): Promise<LdapConfig | null> {
  const sources = await getEnabledLdapSources();
  const source = sources[0] ?? null;
  if (!source) return null;
  return sourceToLdapConfig(source);
}

export function normalizeLdapConfig(input: Record<string, unknown>): LdapConfig {
  const parsed = ldapConfigSchema.parse(input);
  const bindPassword =
    typeof parsed.bindPassword === "string" && parsed.bindPassword.includes(":")
      ? decryptSecret(parsed.bindPassword)
      : parsed.bindPassword;
  return { ...parsed, bindPassword };
}

export async function testLdapConnection(
  config: LdapConfig,
): Promise<{ ok: boolean; error?: string }> {
  let client: Client | null = null;
  try {
    client = await bindAdmin(config);
    return { ok: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ error: errorMsg }, "LDAP connection test failed");
    return { ok: false, error: errorMsg };
  } finally {
    if (client) {
      try {
        await client.unbind();
      } catch {
        // ignore
      }
    }
  }
}

export async function searchLdapGroups(
  config: LdapConfig,
  query: string,
): Promise<LdapGroupSuggestion[]> {
  const client = await bindAdmin(config);
  try {
    const base = domainDn(config.upnSuffix ?? config.bindUpn);
    const escaped = query
      .replace(/\\/g, "\\5c")
      .replace(/\*/g, "\\2a")
      .replace(/\(/g, "\\28")
      .replace(/\)/g, "\\29");
    const filter = `(&(objectClass=group)(|(cn=*${escaped}*)(sAMAccountName=*${escaped}*)))`;
    const result = await client.search(base, {
      filter,
      scope: "sub",
      sizeLimit: 10,
      attributes: ["cn", "sAMAccountName"],
    });
    return result.searchEntries.map((e) => ({
      dn: e.dn,
      name: attr(e, "cn") ?? attr(e, "sAMAccountName") ?? e.dn,
    }));
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore
    }
  }
}

export async function ldapAuth(
  username: string,
  password: string,
  sourceId?: string,
): Promise<LdapAuthResult> {
  const source = sourceId
    ? await getLdapSource(sourceId)
    : await getFirstEnabledLdapSource();
  if (!source || !source.enabled) {
    return { success: false, error: "LDAP not configured" };
  }
  const config = sourceToLdapConfig(source);

  let client: Client | null = null;
  try {
    const clientOpts: ConstructorParameters<typeof Client>[0] = {
      url: config.url,
    };

    if (config.tlsCaCert) {
      clientOpts.tlsOptions = {
        ca: config.tlsCaCert,
        rejectUnauthorized: true,
      };
    }

    client = new Client(clientOpts);

    const suffix = config.upnSuffix?.replace(/^@/, "") || "ldap.local";
    const email = username.includes("@") ? username : `${username}@${suffix}`;
    const displayName = username.split("@")[0] || username;

    await client.bind(email, password);
    await client.unbind();

    let user = await prisma.user.findUnique({ where: { email } });

    if (user && user.status === "suspended") {
      return { success: false, error: "Account suspended" };
    }
    if (user && user.status === "ldapGroupRemoved") {
      return { success: false, error: "LDAP group removed" };
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          displayName,
          passwordHash: null,
          locale: "fa_IR",
          status: "active",
        },
      });

      await logAudit({
        actorUserId: null,
        action: "user_jit_created",
        entityType: "user",
        entityId: user.id,
        after: { email, provider: "ldap" },
      });
    }

    const existingIdentity = await prisma.authIdentity.findFirst({
      where: { provider: "ldap", providerSubject: email },
    });

    if (!existingIdentity) {
      await prisma.authIdentity.create({
        data: {
          userId: user.id,
          provider: "ldap",
          providerSubject: email,
          providerIssuer: source.id,
          lastUsedAt: new Date(),
        },
      });

      await logAudit({
        actorUserId: user.id,
        action: "identity_linked",
        entityType: "authidentity",
        entityId: user.id,
        after: { provider: "ldap", sourceId: source.id },
      });
    } else if (existingIdentity.providerIssuer !== source.id) {
      await prisma.authIdentity.update({
        where: { id: existingIdentity.id },
        data: { providerIssuer: source.id, lastUsedAt: new Date() },
      });
    } else {
      await prisma.authIdentity.update({
        where: { id: existingIdentity.id },
        data: { lastUsedAt: new Date() },
      });
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ error: errorMsg }, "LDAP auth failed");

    if (client) {
      try {
        await client.unbind();
      } catch {
        // Ignore unbind errors
      }
    }

    return { success: false, error: errorMsg };
  }
}