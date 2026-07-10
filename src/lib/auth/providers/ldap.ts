import { Client } from "ldapts";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { ldapConfigSchema, type LdapConfig } from "../ldap-schema";
import { logger } from "@/lib/logging";
import { decryptSecret } from "@/lib/webhook";

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
  const setting = await prisma.settings.findFirst({
    where: { scope: "install", key: "ldap" },
  });
  if (!setting?.valueJson) return null;

  try {
    const parsed = JSON.parse(setting.valueJson as string);
    return ldapConfigSchema.parse(parsed);
  } catch {
    return null;
  }
}

/** Validate a config object (e.g. from the admin form) and decrypt the password if needed. */
export function normalizeLdapConfig(input: Record<string, unknown>): LdapConfig {
  const parsed = ldapConfigSchema.parse(input);
  const bindPassword =
    typeof parsed.bindPassword === "string" && parsed.bindPassword.includes(":")
      ? decryptSecret(parsed.bindPassword)
      : parsed.bindPassword;
  return { ...parsed, bindPassword };
}

async function bindAdmin(config: LdapConfig): Promise<Client> {
  const clientOpts: ConstructorParameters<typeof Client>[0] = { url: config.url };
  if (config.tlsCaCert) {
    clientOpts.tlsOptions = { ca: config.tlsCaCert, rejectUnauthorized: true };
  }
  const client = new Client(clientOpts);
  await client.bind(config.bindUpn, config.bindPassword);
  return client;
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

export async function syncLdapGroup(config: LdapConfig, group: { dn: string; name: string }) {
  const client = await bindAdmin(config);
  try {
    const base = domainDn(config.upnSuffix ?? config.bindUpn);
    const filter = `(&(objectClass=user)(memberOf=${group.dn}))`;
    const result = await client.search(base, {
      filter,
      scope: "sub",
      attributes: ["mail", "cn", "userPrincipalName", "displayName", "sAMAccountName"],
    });

    let count = 0;
    for (const e of result.searchEntries) {
      const upn = attr(e, "userPrincipalName") ?? attr(e, "mail");
      const email = upn ?? attr(e, "mail") ?? attr(e, "sAMAccountName");
      if (!email) continue;
      const displayName =
        attr(e, "displayName") ?? attr(e, "cn") ?? email.split("@")[0] ?? email;

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            displayName,
            passwordHash: null,
            locale: "fa_IR",
            status: "active",
            ldapGroup: group.name,
            ldapGroupId: group.dn,
          },
        });
      } else {
        const data: Record<string, unknown> = {
          ldapGroup: group.name,
          ldapGroupId: group.dn,
        };
        // Re-activate users whose group was previously removed.
        if (user.status === "ldapGroupRemoved") data.status = "active";
        user = await prisma.user.update({ where: { id: user.id }, data });
      }

      if (upn) {
        const identity = await prisma.authIdentity.findFirst({
          where: { provider: "ldap", providerSubject: upn },
        });
        if (!identity) {
          await prisma.authIdentity.create({
            data: { userId: user.id, provider: "ldap", providerSubject: upn },
          });
        }
      }
      count += 1;
    }

    await prisma.ldapSyncGroup.update({
      where: { dn: group.dn },
      data: { lastSyncedAt: new Date() },
    });
    return count;
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore
    }
  }
}

export async function syncAllLdapGroups(config: LdapConfig): Promise<{ groups: number; users: number }> {
  const groups = await prisma.ldapSyncGroup.findMany();
  let users = 0;
  for (const g of groups) {
    users += await syncLdapGroup(config, g);
  }
  return { groups: groups.length, users };
}

export async function ldapAuth(
  username: string,
  password: string,
): Promise<LdapAuthResult> {
  const config = await getLdapConfig();
  if (!config || !config.enabled) {
    return { success: false, error: "LDAP not configured" };
  }

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

    // Authenticate the user by binding as their full UPN.
    const suffix = config.upnSuffix?.replace(/^@/, "") || "ldap.local";
    const email = username.includes("@") ? username : `${username}@${suffix}`;
    const displayName = username.split("@")[0] || username;

    await client.bind(email, password);
    await client.unbind();

    // Find or create user
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

    // Upsert auth identity (subject = UPN/email, which is stable per user)
    const existingIdentity = await prisma.authIdentity.findFirst({
      where: { provider: "ldap", providerSubject: email },
    });

    if (!existingIdentity) {
      await prisma.authIdentity.create({
        data: {
          userId: user.id,
          provider: "ldap",
          providerSubject: email,
        },
      });

      await logAudit({
        actorUserId: user.id,
        action: "identity_linked",
        entityType: "authidentity",
        entityId: user.id,
        after: { provider: "ldap" },
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
