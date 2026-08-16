import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

/**
 * Integration coverage for per-source sync isolation: `syncLdapSource(A)`
 * must reconcile ONLY the groups that belong to source A, leaving source B's
 * groups and memberships untouched, and record success/error state on the
 * right source row. The only mocked boundary is the LDAP network (`ldapts`);
 * every DB read/write runs against the real Postgres.
 */
maybe("per-source LDAP sync isolation", () => {
  const { mockLdapSearch } = vi.hoisted(() => ({ mockLdapSearch: vi.fn() }));

  vi.mock("ldapts", () => ({
    Client: class {
      constructor(_opts: unknown) {}
      async bind() {
        return;
      }
      async unbind() {
        return;
      }
      async search(base: unknown, options: unknown) {
        return mockLdapSearch(base, options);
      }
    },
  }));

  const suffix = `${Date.now()}`;
  let sourceA = "";
  let sourceB = "";
  let groupA = "";
  let groupB = "";

  beforeAll(async () => {
    // Two enabled sources, each with one AD-synced group pointing at it.
    const a = await prisma.ldapSource.create({
      data: {
        name: `Sync A ${suffix}`,
        enabled: true,
        url: "ldaps://a.company.local:636",
        bindUpn: "svc-a@company.local",
        bindPassword: "plain-secret-a",
        upnSuffix: "@a.company.local",
        searchBase: "DC=a,DC=company,DC=local",
      },
    });
    sourceA = a.id;
    const b = await prisma.ldapSource.create({
      data: {
        name: `Sync B ${suffix}`,
        enabled: true,
        url: "ldaps://b.company.local:636",
        bindUpn: "svc-b@company.local",
        bindPassword: "plain-secret-b",
        upnSuffix: "@b.company.local",
        searchBase: "DC=b,DC=company,DC=local",
      },
    });
    sourceB = b.id;

    const ga = await prisma.ldapSyncGroup.create({
      data: {
        name: `Team A ${suffix}`,
        dn: `cn=team-a-${suffix},DC=a,DC=company,DC=local`,
        source: "ldap",
        sourceId: a.id,
      },
    });
    groupA = ga.id;
    const gb = await prisma.ldapSyncGroup.create({
      data: {
        name: `Team B ${suffix}`,
        dn: `cn=team-b-${suffix},DC=b,DC=company,DC=local`,
        source: "ldap",
        sourceId: b.id,
      },
    });
    groupB = gb.id;

    mockLdapSearch.mockImplementation(
      (_base: string, options: { scope?: string; attributes?: string[] }) => {
        // Group base lookups (managedBy) return no manager.
        if (options.scope === "base") return { searchEntries: [] };
        // Member search returns a user whose UPN carries the source letter so
        // the two directories are distinguishable.
        const dn = String(_base);
        const letter = dn.includes("DC=a") ? "a" : "b";
        return {
          searchEntries: [
            {
              dn: `cn=user-${letter},${dn}`,
              userPrincipalName: `user-${letter}-${suffix}@${letter}.company.local`,
              displayName: `User ${letter}`,
              sAMAccountName: `user-${letter}`,
            },
          ],
        };
      },
    );
  });

  afterAll(async () => {
    await prisma.ldapGroupMembership.deleteMany({ where: { ldapSyncGroupId: { in: [groupA, groupB] } } });
    await prisma.user.deleteMany({ where: { email: { contains: `-${suffix}@` } } });
    await prisma.ldapSyncGroup.deleteMany({ where: { id: { in: [groupA, groupB] } } });
    await prisma.ldapSource.deleteMany({ where: { id: { in: [sourceA, sourceB] } } });
    vi.restoreAllMocks();
  });

  it("syncs only source A's group and leaves source B untouched", async () => {
    const { syncLdapSource } = await import("@/lib/auth/providers/ldap");
    const result = await syncLdapSource(sourceA);

    expect(result).toEqual({ groups: 1, users: 1 });

    // Group A: membership created + lastSyncedAt bumped.
    const membersA = await prisma.ldapGroupMembership.count({ where: { ldapSyncGroupId: groupA } });
    expect(membersA).toBe(1);
    const groupARow = await prisma.ldapSyncGroup.findUnique({ where: { id: groupA } });
    expect(groupARow!.lastSyncedAt).not.toBeNull();

    // Group B: no membership, no lastSyncedAt — the sync never touched it.
    const membersB = await prisma.ldapGroupMembership.count({ where: { ldapSyncGroupId: groupB } });
    expect(membersB).toBe(0);
    const groupBRow = await prisma.ldapSyncGroup.findUnique({ where: { id: groupB } });
    expect(groupBRow!.lastSyncedAt).toBeNull();

    // Source rows: A recorded a successful sync, B has no sync state.
    const sourceARow = await prisma.ldapSource.findUnique({ where: { id: sourceA } });
    expect(sourceARow!.lastSyncedAt).not.toBeNull();
    expect(sourceARow!.lastSyncError).toBeNull();
    const sourceBRow = await prisma.ldapSource.findUnique({ where: { id: sourceB } });
    expect(sourceBRow!.lastSyncedAt).toBeNull();
    expect(sourceBRow!.lastSyncError).toBeNull();
  });

  it("records a failure on the failing source without touching the other", async () => {
    const { syncAllLdapSources } = await import("@/lib/auth/providers/ldap");

    // Make source B's directory read fail; source A still succeeds.
    mockLdapSearch.mockImplementation(
      (_base: string, options: { scope?: string }) => {
        if (options.scope === "base") return { searchEntries: [] };
        const dn = String(_base);
        if (dn.includes("DC=b")) throw new Error("B directory down");
        return {
          searchEntries: [
            {
              dn: `cn=user-a,${dn}`,
              userPrincipalName: `user-a-${suffix}@a.company.local`,
              displayName: "User A",
              sAMAccountName: "user-a",
            },
          ],
        };
      },
    );

    // Both sources are enabled; the failing one must not stop the other.
    const result = await syncAllLdapSources();
    expect(result.sources).toBe(2);
    expect(result.groups).toBe(1);
    expect(result.users).toBe(1);

    const sourceBRow = await prisma.ldapSource.findUnique({ where: { id: sourceB } });
    expect(sourceBRow!.lastSyncError).toBe("B directory down");
    expect(sourceBRow!.lastSyncedAt).toBeNull();

    const sourceARow = await prisma.ldapSource.findUnique({ where: { id: sourceA } });
    expect(sourceARow!.lastSyncError).toBeNull();
  });
});
