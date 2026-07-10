import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ldapts", () => ({
  Client: class {
    constructor(_opts: unknown) {}
    async bind() {
      return;
    }
    async unbind() {
      return;
    }
    async search() {
      return {
        searchEntries: [
          {
            dn: "cn=alice,dc=company,dc=local",
            userPrincipalName: "alice@company.local",
            displayName: "Alice A",
            sAMAccountName: "alice",
          },
        ],
      };
    }
  },
}));

const prisma = {
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  authIdentity: { findFirst: vi.fn(), create: vi.fn() },
  ldapSyncGroup: { findMany: vi.fn(), update: vi.fn() },
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
  searchBase: "dc=company,dc=local",
  syncIntervalHours: 12,
} as unknown as Parameters<typeof syncLdapGroup>[0];

const group = { dn: "cn=eng,dc=company,dc=local", name: "Engineering" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.update.mockResolvedValue({ id: "u1" });
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
          ldapGroupId: "cn=eng,dc=company,dc=local",
        }),
      }),
    );
    expect(prisma.authIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: "ldap", providerSubject: "alice@company.local" }),
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
          ldapGroupId: "cn=eng,dc=company,dc=local",
        }),
      }),
    );
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
});
