import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logging";
import type { LdapConfig } from "../ldap-schema";
import { sourceToLdapConfig } from "../ldap-sources";
import { escapeLdapFilterValue } from "./ldap-helpers";
import { bindAdmin } from "./ldap-helpers";

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

function attr(entry: Record<string, unknown>, key: string): string | null {
  const v = entry[key];
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : null;
  return typeof v === "string" ? v : null;
}

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

function domainDn(upn: string): string {
  const domain = upn.includes("@") ? upn.split("@")[1]! : upn;
  return domain
    .split(".")
    .filter(Boolean)
    .map((p) => `dc=${p}`)
    .join(",");
}

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
      sourceMemberDn: { not: null },
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

export async function syncLdapSource(
  sourceId: string,
): Promise<{ groups: number; users: number }> {
  const source = await prisma.ldapSource.findFirst({
    where: { id: sourceId, deletedAt: null },
  });
  if (!source) {
    throw new Error("LDAP source not found");
  }

  const config = sourceToLdapConfig(source);

  const groups: LdapGroup[] = (await prisma.ldapSyncGroup.findMany({
    where: { deletedAt: null, source: "ldap", sourceId },
  })).flatMap((group) =>
    group.dn ? [{ id: group.id, dn: group.dn, name: group.name }] : [],
  );

  try {
    const stagedSnapshots: LdapGroupSnapshot[] = [];
    for (const group of groups) {
      stagedSnapshots.push(await fetchLdapGroupSnapshot(config, group));
    }

    const result = await prisma.$transaction(async (tx) => {
      let users = 0;
      for (const snapshot of stagedSnapshots) {
        users += await applyLdapGroupSnapshot(tx, snapshot);
      }
      return { groups: groups.length, users };
    });

    await prisma.ldapSource.update({
      where: { id: source.id },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.ldapSource.update({
      where: { id: source.id },
      data: { lastSyncError: message },
    });
    throw err;
  }
}

export async function syncAllLdapSources(): Promise<{ sources: number; groups: number; users: number }> {
  const { getEnabledLdapSources } = await import("../ldap-sources");
  const sources = await getEnabledLdapSources();
  let groups = 0;
  let users = 0;
  for (const source of sources) {
    try {
      const result = await syncLdapSource(source.id);
      groups += result.groups;
      users += result.users;
    } catch (err) {
      logger.error(
        { err, sourceId: source.id, sourceName: source.name },
        "LDAP source sync failed; continuing with remaining sources",
      );
    }
  }
  return { sources: sources.length, groups, users };
}