import { Client } from "ldapts";
import { Prisma } from "@prisma/client";
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

function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (character) => {
    switch (character) {
      case "\\":
        return "\\5c";
      case "*":
        return "\\2a";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      default:
        return "\\00";
    }
  });
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

type LdapGroup = { id: string; dn: string; name: string };
type LdapSearchEntry = Record<string, unknown> & { dn: string };
type LdapGroupSnapshot = {
  group: LdapGroup;
  entries: LdapSearchEntry[];
  managerDn: string | null;
  managerEmail: string | null;
};
type LdapDatabase = Pick<
  Prisma.TransactionClient,
  "user" | "authIdentity" | "projectMember" | "ldapGroupMembership" | "ldapSyncGroup" | "department"
>;

/**
 * Reads one directory snapshot for a group: its members, its `managedBy`
 * attribute (the AD-declared manager), and that manager's email/UPN. All reads
 * happen before any write so a failed directory read leaves the previous
 * authorization snapshot untouched.
 */
async function fetchLdapGroupSnapshot(
  config: LdapConfig,
  group: LdapGroup,
): Promise<LdapGroupSnapshot> {
  const client = await bindAdmin(config);
  try {
    const base = config.searchBase ?? domainDn(config.upnSuffix ?? config.bindUpn);
    const filter = `(&(objectClass=user)(memberOf:1.2.840.113556.1.4.1941:=${escapeLdapFilterValue(group.dn)}))`;
    const result = await client.search(base, {
      filter,
      scope: "sub",
      attributes: ["mail", "cn", "userPrincipalName", "displayName", "sAMAccountName", "distinguishedName"],
    });
    const entries = result.searchEntries;
    if (
      !Array.isArray(entries)
      || entries.some((entry) => typeof entry !== "object" || entry === null || typeof entry.dn !== "string")
    ) {
      throw new Error("LDAP group search returned an incomplete response");
    }

    let managerDn: string | null = null;
    let managerEmail: string | null = null;
    const groupResult = await client.search(group.dn, {
      scope: "base",
      attributes: ["managedBy"],
    });
    managerDn = groupResult.searchEntries[0]
      ? attr(groupResult.searchEntries[0], "managedBy")
      : null;
    if (managerDn) {
      const managerResult = await client.search(managerDn, {
        scope: "base",
        attributes: ["mail", "userPrincipalName"],
      });
      const managerEntry = managerResult.searchEntries[0];
      managerEmail = managerEntry
        ? (attr(managerEntry, "userPrincipalName") ?? attr(managerEntry, "mail"))
        : null;
    }

    return {
      group,
      entries: entries as LdapSearchEntry[],
      managerDn,
      managerEmail,
    };
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore
    }
  }
}

/**
 * Applies the AD-declared manager to the group's department. AD is the source
 * of truth unless an admin explicitly picked a manager (managerSource =
 * "manual"); manual choices survive syncs.
 */
async function applyLdapDepartmentManager(
  db: LdapDatabase,
  group: LdapGroup,
  managerEmail: string | null,
): Promise<void> {
  const department = await db.department.findUnique({
    where: { ldapSyncGroupId: group.id },
    select: { id: true, managerUserId: true, managerSource: true },
  });
  if (!department || department.managerSource === "manual") return;

  let nextManagerUserId: string | null = null;
  let nextManagerSource: "ad" | null = null;
  if (managerEmail) {
    const manager = await db.user.findUnique({
      where: { email: managerEmail },
      select: { id: true, status: true },
    });
    if (!manager || manager.status !== "active") {
      // AD names a manager we cannot resolve yet — keep the current state.
      return;
    }
    nextManagerUserId = manager.id;
    nextManagerSource = "ad";
  }

  if (
    department.managerUserId === nextManagerUserId
    && department.managerSource === nextManagerSource
  ) {
    return;
  }

  await db.department.update({
    where: { id: department.id },
    data: { managerUserId: nextManagerUserId, managerSource: nextManagerSource },
  });

  await logAudit({
    actorUserId: null,
    action: "department_updated",
    entityType: "department",
    entityId: department.id,
    before: {
      managerUserId: department.managerUserId,
      managerSource: department.managerSource,
    },
    after: {
      managerUserId: nextManagerUserId,
      managerSource: nextManagerSource,
    },
  });
}

async function applyLdapGroupSnapshot(
  db: LdapDatabase,
  snapshot: LdapGroupSnapshot,
): Promise<number> {
  const { group, entries, managerDn, managerEmail } = snapshot;
  const syncedAt = new Date();
  let count = 0;
  for (const e of entries) {
    const upn = attr(e, "userPrincipalName") ?? attr(e, "mail");
    const email = upn ?? attr(e, "mail") ?? attr(e, "sAMAccountName");
    if (!email) continue;
    const displayName =
      attr(e, "displayName") ?? attr(e, "cn") ?? email.split("@")[0] ?? email;

    let user = await db.user.findUnique({ where: { email } });
    const wasRemovedFromLdap = user?.status === "ldapGroupRemoved";
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          displayName,
          passwordHash: null,
          locale: "fa_IR",
          status: "active",
          ldapGroup: group.name,
          ldapGroupId: null,
        },
      });
    } else {
      const data: Record<string, unknown> = {
        ldapGroup: group.name,
        ldapGroupId: null,
      };
      // Re-activate users whose group was previously removed.
      if (user.status === "ldapGroupRemoved") data.status = "active";
      user = await db.user.update({ where: { id: user.id }, data });
    }

    if (wasRemovedFromLdap) {
      await db.projectMember.updateMany({
        where: { userId: user.id, disabledReason: "ldap" },
        data: { disabledAt: null, disabledReason: null },
      });
    }

    if (upn) {
      const identity = await db.authIdentity.findFirst({
        where: { provider: "ldap", providerSubject: upn },
      });
      if (!identity) {
        await db.authIdentity.create({
          data: { userId: user.id, provider: "ldap", providerSubject: upn },
        });
      }
    }

    await db.ldapGroupMembership.upsert({
      where: {
        userId_ldapSyncGroupId: {
          userId: user.id,
          ldapSyncGroupId: group.id,
        },
      },
      create: {
        userId: user.id,
        ldapSyncGroupId: group.id,
        sourceMemberDn: e.dn,
        lastSeenAt: syncedAt,
      },
      update: {
        sourceMemberDn: e.dn,
        lastSeenAt: syncedAt,
      },
    });
    count += 1;
  }

  await db.ldapGroupMembership.deleteMany({
    where: {
      ldapSyncGroupId: group.id,
      lastSeenAt: { lt: syncedAt },
    },
  });

  await db.ldapSyncGroup.update({
    where: { dn: group.dn },
    data: { lastSyncedAt: new Date(), managerDn },
  });

  await applyLdapDepartmentManager(db, group, managerEmail);
  return count;
}

export async function syncLdapGroup(
  config: LdapConfig,
  group: LdapGroup,
) {
  const snapshot = await fetchLdapGroupSnapshot(config, group);
  return prisma.$transaction((tx) => applyLdapGroupSnapshot(tx, snapshot));
}

export async function syncAllLdapGroups(config: LdapConfig): Promise<{ groups: number; users: number }> {
  const groups = await prisma.ldapSyncGroup.findMany({ where: { deletedAt: null } });
  const stagedSnapshots: LdapGroupSnapshot[] = [];

  // Read every group before changing users or memberships. A failed directory
  // read therefore leaves the previous authorization snapshot untouched.
  for (const group of groups) {
    stagedSnapshots.push(await fetchLdapGroupSnapshot(config, group));
  }

  return prisma.$transaction(async (tx) => {
    let users = 0;
    for (const snapshot of stagedSnapshots) {
      users += await applyLdapGroupSnapshot(tx, snapshot);
    }
    return { groups: groups.length, users };
  });
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
