import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLdapSearch } = vi.hoisted(() => ({
  mockLdapSearch: vi.fn(),
}));

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

const prisma = {
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  authIdentity: { findFirst: vi.fn(), create: vi.fn() },
  projectMember: { updateMany: vi.fn() },
  ldapSyncGroup: { findMany: vi.fn(), update: vi.fn() },
  ldapGroupMembership: { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  department: { findUnique: vi.fn(), update: vi.fn() },
  ldapSource: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ prisma: prisma }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));

const { syncLdapGroup, syncLdapSource, syncAllLdapSources } = await import("@/lib/auth/providers/ldap");

const config = {
  enabled: true,
  host: "ldap://dc.company.local",
  port: 389,
  secure: false,
  bindUpn: "svc@company.local",
  bindPassword: "secret",
  upnSuffix: undefined,
  searchBase: "ou=Users,dc=company,dc=local",
  syncIntervalHours: 12,
} as unknown as Parameters<typeof syncLdapGroup>[0];

const group = { id: "group-1", dn: "cn=eng,dc=company,dc=local", name: "Engineering" };

beforeEach(() => {
  vi.clearAllMocks();
  mockLdapSearch.mockResolvedValue({
    searchEntries: [{
      dn: "cn=alice,dc=company,dc=local",
      userPrincipalName: "alice@company.local",
      displayName: "Alice A",
      sAMAccountName: "alice",
    }],
  });
  prisma.user.update.mockResolvedValue({ id: "u1" });
  prisma.ldapGroupMembership.findMany.mockResolvedValue([]);
  prisma.ldapGroupMembership.deleteMany.mockResolvedValue({ count: 0 });
  prisma.ldapGroupMembership.upsert.mockResolvedValue({});
  prisma.department.findUnique.mockResolvedValue(null);
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
});

describe("syncLdapGroup", () => {
  it("creates a new user tagged with the LDAP group", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "new-id" });
    prisma.authIdentity.findFirst.mockResolvedValue(null);

    await syncLdapGroup(config, group);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "alice@company.local",
          status: "active",
          ldapGroup: "Engineering",
          ldapGroupId: null,
        }),
      }),
    );
    expect(prisma.authIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: "ldap", providerSubject: "alice@company.local" }),
      }),
    );
    expect(prisma.ldapGroupMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_ldapSyncGroupId: { userId: "new-id", ldapSyncGroupId: "group-1" } },
        create: expect.objectContaining({
          userId: "new-id",
          ldapSyncGroupId: "group-1",
          sourceMemberDn: "cn=alice,dc=company,dc=local",
        }),
      }),
    );
    expect(prisma.ldapGroupMembership.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ldapSyncGroupId: "group-1",
          sourceMemberDn: { not: null },
          lastSeenAt: expect.any(Object),
        },
      }),
    );
    expect(mockLdapSearch).toHaveBeenCalledWith(
      "ou=Users,dc=company,dc=local",
      expect.objectContaining({
        filter: expect.stringContaining("1.2.840.113556.1.4.1941"),
      }),
    );
  });

  it("re-activates a user previously removed from the group", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "alice@company.local",
      status: "ldapGroupRemoved",
    });
    prisma.authIdentity.findFirst.mockResolvedValue(null);

    await syncLdapGroup(config, group);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({
          status: "active",
          ldapGroup: "Engineering",
          ldapGroupId: null,
        }),
      }),
    );
    expect(prisma.projectMember.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", disabledReason: "ldap" },
      data: { disabledAt: null, disabledReason: null },
    });
  });

  it("does not re-create an existing identity", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "alice@company.local",
      status: "active",
    });
    prisma.authIdentity.findFirst.mockResolvedValue({ id: "id-1" });

    await syncLdapGroup(config, group);

    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.authIdentity.create).not.toHaveBeenCalled();
  });

  it("auto-assigns the AD-declared manager when no manual manager is set", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // member lookup → user is new
      .mockResolvedValueOnce({ id: "manager-1", status: "active" }); // manager lookup
    prisma.user.create.mockResolvedValue({ id: "u1" });
    prisma.authIdentity.findFirst.mockResolvedValue(null);
    prisma.department.findUnique.mockResolvedValue({
      id: "department-1",
      managerUserId: null,
      managerSource: null,
    });

    mockLdapSearch.mockImplementation((_base: string, options: { scope?: string; attributes?: string[] }) => {
      if (options.scope === "base" && options.attributes?.includes("managedBy")) {
        return {
          searchEntries: [{ dn: "cn=eng,dc=company,dc=local", managedBy: ["cn=jane,dc=company,dc=local"] }],
        };
      }
      if (options.scope === "base") {
        return {
          searchEntries: [{ dn: "cn=jane,dc=company,dc=local", userPrincipalName: "jane@company.local" }],
        };
      }
      return {
        searchEntries: [{
          dn: "cn=alice,dc=company,dc=local",
          userPrincipalName: "alice@company.local",
          displayName: "Alice A",
          sAMAccountName: "alice",
        }],
      };
    });

    await syncLdapGroup(config, group);

    expect(prisma.ldapSyncGroup.update).toHaveBeenCalledWith({
      where: { dn: group.dn },
      data: expect.objectContaining({ managerDn: "cn=jane,dc=company,dc=local" }),
    });
    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "department-1" },
      data: { managerUserId: "manager-1", managerSource: "ad" },
    });
  });

  it("does not overwrite a manually chosen manager during sync", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "alice@company.local",
      status: "active",
    });
    prisma.authIdentity.findFirst.mockResolvedValue({ id: "id-1" });
    prisma.department.findUnique.mockResolvedValue({
      id: "department-1",
      managerUserId: "manual-manager",
      managerSource: "manual",
    });

    await syncLdapGroup(config, group);

    expect(prisma.department.update).not.toHaveBeenCalled();
  });

  it("reconciles only AD-origin memberships so manual members survive", async () => {
    // Manual memberships carry no `sourceMemberDn` and must never be swept by
    // the stale-`lastSeenAt` reconcile; only AD-origin rows are eligible.
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "alice@company.local",
      status: "active",
    });
    prisma.authIdentity.findFirst.mockResolvedValue({ id: "id-1" });

    await syncLdapGroup(config, group);

    expect(prisma.ldapGroupMembership.deleteMany).toHaveBeenCalledWith({
      where: {
        ldapSyncGroupId: "group-1",
        sourceMemberDn: { not: null },
        lastSeenAt: expect.any(Object),
      },
    });
  });

  it("keeps bumping lastSeenAt for AD members on hybrid groups", async () => {
    // A hybrid group has both AD-origin and manual rows. The upsert path must
    // still refresh the AD member's `lastSeenAt` (so it is not treated as
    // stale) while leaving manual rows untouched by the reconcile.
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "alice@company.local",
      status: "active",
    });
    prisma.authIdentity.findFirst.mockResolvedValue({ id: "id-1" });

    await syncLdapGroup(config, group);

    expect(prisma.ldapGroupMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_ldapSyncGroupId: { userId: "u1", ldapSyncGroupId: "group-1" } },
        update: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      }),
    );
    // The reconcile delete must never match manual rows (sourceMemberDn null).
    expect(prisma.ldapGroupMembership.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sourceMemberDn: { not: null } }),
      }),
    );
  });
});

const source = {
  id: "source-1",
  name: "Company Directory",
  enabled: true,
  url: "ldaps://dc.company.local:636",
  bindUpn: "svc@company.local",
  bindPassword: "plain-secret",
  upnSuffix: "@company.local",
  searchBase: "ou=Users,dc=company,dc=local",
  emailAttribute: "mail",
  nameAttribute: "cn",
  defaultRole: "member",
  syncIntervalHours: 12,
  tlsCaCert: null,
  lastSyncedAt: null,
  lastSyncError: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as never;

describe("syncLdapSource", () => {
  it("synchronizes only groups belonging to that source", async () => {
    prisma.ldapSource.findFirst.mockResolvedValue(source);
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group]);

    await expect(syncLdapSource("source-1")).resolves.toEqual({ groups: 1, users: 1 });

    expect(prisma.ldapSyncGroup.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, source: "ldap", sourceId: "source-1" },
    });
    expect(prisma.ldapSource.update).toHaveBeenCalledWith({
      where: { id: "source-1" },
      data: { lastSyncedAt: expect.any(Date), lastSyncError: null },
    });
  });

  it("rejects an unknown source", async () => {
    prisma.ldapSource.findFirst.mockResolvedValue(null);
    await expect(syncLdapSource("missing")).rejects.toThrow("LDAP source not found");
  });

  it("records lastSyncError and rethrows when a directory read fails", async () => {
    prisma.ldapSource.findFirst.mockResolvedValue(source);
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group]);
    mockLdapSearch.mockRejectedValueOnce(new Error("LDAP unavailable"));

    await expect(syncLdapSource("source-1")).rejects.toThrow("LDAP unavailable");
    expect(prisma.ldapSource.update).toHaveBeenCalledWith({
      where: { id: "source-1" },
      data: { lastSyncError: "LDAP unavailable" },
    });
    expect(prisma.ldapGroupMembership.upsert).not.toHaveBeenCalled();
  });

  it("never reconciles manual groups or groups from other sources", async () => {
    // Emulate the real query filter (`source: "ldap", sourceId`) so rows that
    // Prisma would exclude never reach the sync loop.
    const manualGroup = { id: "group-manual", dn: null, name: "Design Team", source: "manual" };
    const otherSourceGroup = { id: "group-other", dn: "cn=ops,dc=company,dc=local", name: "Ops", source: "ldap", sourceId: "source-2" };
    prisma.ldapSource.findFirst.mockResolvedValue(source);
    prisma.ldapSyncGroup.findMany.mockImplementation(async ({ where }: { where: { source: string; sourceId: string } }) =>
      [manualGroup, otherSourceGroup].filter(
        (g) =>
          g.source === where.source
          && g.sourceId === where.sourceId
          && (g as { deletedAt?: Date | null }).deletedAt === null,
      ) as never,
    );

    await expect(syncLdapSource("source-1")).resolves.toEqual({ groups: 0, users: 0 });
    expect(prisma.ldapSyncGroup.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, source: "ldap", sourceId: "source-1" },
    });
    expect(mockLdapSearch).not.toHaveBeenCalled();
    // A transaction still opens (to record lastSyncedAt), but no memberships
    // are written and the directory is never queried.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.ldapGroupMembership.upsert).not.toHaveBeenCalled();
  });

  it("does not reconcile earlier groups when a later LDAP read fails", async () => {
    prisma.ldapSource.findFirst.mockResolvedValue(source);
    const secondGroup = { id: "group-2", dn: "cn=ops,dc=company,dc=local", name: "Operations" };
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group, secondGroup]);
    mockLdapSearch
      .mockResolvedValueOnce({ searchEntries: [{ dn: "cn=alice,dc=company,dc=local", userPrincipalName: "alice@company.local" }] })
      .mockRejectedValueOnce(new Error("LDAP unavailable"));

    await expect(syncLdapSource("source-1")).rejects.toThrow("LDAP unavailable");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.ldapGroupMembership.upsert).not.toHaveBeenCalled();
    expect(prisma.ldapGroupMembership.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects an incomplete LDAP response before opening a write transaction", async () => {
    prisma.ldapSource.findFirst.mockResolvedValue(source);
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group]);
    mockLdapSearch.mockResolvedValueOnce({});

    await expect(syncLdapSource("source-1")).rejects.toThrow("incomplete response");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.ldapGroupMembership.upsert).not.toHaveBeenCalled();
  });

  it("applies the complete staged snapshot inside one transaction", async () => {
    prisma.ldapSource.findFirst.mockResolvedValue(source);
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group]);

    await syncLdapSource("source-1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("syncAllLdapSources", () => {
  it("syncs every enabled source and aggregates the counts", async () => {
    prisma.ldapSource.findMany.mockResolvedValue([source]);
    prisma.ldapSource.findFirst.mockResolvedValue(source);
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group]);

    await expect(syncAllLdapSources()).resolves.toEqual({ sources: 1, groups: 1, users: 1 });
    expect(prisma.ldapSource.update).toHaveBeenCalledWith({
      where: { id: "source-1" },
      data: { lastSyncedAt: expect.any(Date), lastSyncError: null },
    });
  });

  it("continues past a failing source and records its error", async () => {
    const badSource = { ...source, id: "source-bad" };
    prisma.ldapSource.findMany.mockResolvedValue([badSource, source]);
    prisma.ldapSource.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "source-bad" ? badSource : source,
    );
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group]);
    mockLdapSearch.mockRejectedValueOnce(new Error("LDAP unavailable"));

    await expect(syncAllLdapSources()).resolves.toEqual({ sources: 2, groups: 1, users: 1 });
    expect(prisma.ldapSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastSyncError: "LDAP unavailable" }),
      }),
    );
  });
});
