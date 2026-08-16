import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLdapBind } = vi.hoisted(() => ({
  mockLdapBind: vi.fn(),
}));

vi.mock("ldapts", () => ({
  Client: class {
    constructor(_opts: unknown) {}
    async bind(...args: unknown[]) {
      return mockLdapBind(...args);
    }
    async unbind() {
      return;
    }
  },
}));

const prisma = {
  user: { findUnique: vi.fn(), create: vi.fn() },
  authIdentity: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: prisma }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));

const enabledSource = {
  id: "src-1",
  name: "Corp Directory",
  enabled: true,
  url: "ldaps://dc.corp.local:636",
  bindUpn: "svc@corp.local",
  bindPassword: "plain-secret",
  upnSuffix: "@corp.local",
  searchBase: "DC=corp,DC=local",
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
};

vi.mock("@/lib/auth/ldap-sources", () => ({
  getLdapSource: vi.fn(async (id: string) =>
    id === enabledSource.id ? enabledSource : null,
  ),
  getFirstEnabledLdapSource: vi.fn(async () => enabledSource),
  getEnabledLdapSources: vi.fn(async () => [enabledSource]),
  sourceToLdapConfig: vi.fn((source: typeof enabledSource) => ({
    enabled: source.enabled,
    url: source.url,
    bindUpn: source.bindUpn,
    bindPassword: source.bindPassword,
    upnSuffix: source.upnSuffix,
    searchBase: source.searchBase,
    emailAttribute: source.emailAttribute,
    nameAttribute: source.nameAttribute,
    defaultRole: source.defaultRole,
    syncIntervalHours: source.syncIntervalHours,
    tlsCaCert: source.tlsCaCert ?? undefined,
  })),
}));

const { ldapAuth } = await import("@/lib/auth/providers/ldap");

beforeEach(() => {
  vi.clearAllMocks();
  mockLdapBind.mockResolvedValue(undefined);
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.user.create.mockImplementation(async ({ data }) => ({
    id: "user-new",
    email: data.email,
    displayName: data.displayName,
    status: "active",
  }));
  prisma.authIdentity.findFirst.mockResolvedValue(null);
  prisma.authIdentity.create.mockResolvedValue({ id: "id-1" });
});

describe("ldapAuth source selection", () => {
  it("authenticates against an explicit sourceId", async () => {
    prisma.authIdentity.create.mockResolvedValue({ id: "id-1" });

    const result = await ldapAuth("alice", "secret", "src-1");

    expect(result.success).toBe(true);
    expect(mockLdapBind).toHaveBeenCalledWith("alice@corp.local", "secret");
    // identity records the source as issuer
    expect(prisma.authIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "ldap",
          providerSubject: "alice@corp.local",
          providerIssuer: "src-1",
        }),
      }),
    );
  });

  it("rejects an unknown sourceId", async () => {
    const result = await ldapAuth("alice", "secret", "missing-source");

    expect(result.success).toBe(false);
    expect(result.error).toBe("LDAP not configured");
    expect(mockLdapBind).not.toHaveBeenCalled();
  });

  it("rejects a disabled sourceId", async () => {
    vi.mocked(await import("@/lib/auth/ldap-sources")).getLdapSource.mockResolvedValueOnce({
      ...enabledSource,
      enabled: false,
    } as never);

    const result = await ldapAuth("alice", "secret", "src-1");

    expect(result.success).toBe(false);
    expect(mockLdapBind).not.toHaveBeenCalled();
  });

  it("falls back to the first enabled source when sourceId is omitted", async () => {
    const result = await ldapAuth("alice", "secret");

    expect(result.success).toBe(true);
    expect(mockLdapBind).toHaveBeenCalledWith("alice@corp.local", "secret");
    expect(prisma.authIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerIssuer: "src-1" }),
      }),
    );
  });

  it("updates the issuer when the same UPN appears in a second directory", async () => {
    prisma.authIdentity.findFirst.mockResolvedValue({
      id: "id-1",
      providerIssuer: "src-old",
    });
    prisma.authIdentity.update.mockResolvedValue({ id: "id-1" });

    const result = await ldapAuth("alice", "secret", "src-1");

    expect(result.success).toBe(true);
    expect(prisma.authIdentity.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { providerIssuer: "src-1", lastUsedAt: expect.any(Date) },
    });
    expect(prisma.authIdentity.create).not.toHaveBeenCalled();
  });

  it("bumps lastUsedAt when the identity already belongs to this source", async () => {
    prisma.authIdentity.findFirst.mockResolvedValue({
      id: "id-1",
      providerIssuer: "src-1",
    });
    prisma.authIdentity.update.mockResolvedValue({ id: "id-1" });

    const result = await ldapAuth("alice", "secret", "src-1");

    expect(result.success).toBe(true);
    expect(prisma.authIdentity.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(prisma.authIdentity.create).not.toHaveBeenCalled();
  });
});
