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
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ prisma: prisma }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));

const { syncLdapGroup } = await import("@/lib/auth/providers/ldap");

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
      expect.objectContaining({ where: { ldapSyncGroupId: "group-1", lastSeenAt: expect.any(Object) } }),
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
});

describe("syncAllLdapGroups", () => {
  it("does not synchronize archived LDAP selections", async () => {
    const { syncAllLdapGroups } = await import("@/lib/auth/providers/ldap");
    prisma.ldapSyncGroup.findMany.mockResolvedValue([]);

    await expect(syncAllLdapGroups(config)).resolves.toEqual({ groups: 0, users: 0 });
    expect(prisma.ldapSyncGroup.findMany).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it("does not reconcile earlier groups when a later LDAP read fails", async () => {
    const { syncAllLdapGroups } = await import("@/lib/auth/providers/ldap");
    const secondGroup = { id: "group-2", dn: "cn=ops,dc=company,dc=local", name: "Operations" };
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group, secondGroup]);
    mockLdapSearch
      .mockResolvedValueOnce({ searchEntries: [{ dn: "cn=alice,dc=company,dc=local", userPrincipalName: "alice@company.local" }] })
      .mockRejectedValueOnce(new Error("LDAP unavailable"));

    await expect(syncAllLdapGroups(config)).rejects.toThrow("LDAP unavailable");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.ldapGroupMembership.upsert).not.toHaveBeenCalled();
    expect(prisma.ldapGroupMembership.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects an incomplete LDAP response before opening a write transaction", async () => {
    const { syncAllLdapGroups } = await import("@/lib/auth/providers/ldap");
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group]);
    mockLdapSearch.mockResolvedValueOnce({});

    await expect(syncAllLdapGroups(config)).rejects.toThrow("incomplete response");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.ldapGroupMembership.upsert).not.toHaveBeenCalled();
  });

  it("applies the complete staged snapshot inside one transaction", async () => {
    const { syncAllLdapGroups } = await import("@/lib/auth/providers/ldap");
    prisma.ldapSyncGroup.findMany.mockResolvedValue([group]);

    await syncAllLdapGroups(config);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
