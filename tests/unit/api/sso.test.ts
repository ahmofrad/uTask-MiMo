import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "test-only-encryption-key";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
const mockCan = vi.fn();
const mockCanProject = vi.fn();
vi.mock("@/lib/rbac", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/rbac/can", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSource: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    task: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tag: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/auth/ldap-sources", () => ({
  getFirstLdapSource: vi.fn(),
  getEnabledLdapSources: vi.fn(),
  redactLdapSource: vi.fn((s: unknown) => s as Record<string, unknown>),
  deriveLdapSourceName: vi.fn(() => "Active Directory"),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/webhook/emit", () => ({ emitTaskEvent: vi.fn() }));
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => ({ hit: false })),
  setIdempotencyResult: vi.fn(),
}));
vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/admin/sso", init);
}

const { auth } = await import("@/lib/auth/config");
const { getSettings, updateSettings } = await import("@/lib/settings");
const { logAudit } = await import("@/lib/audit/log");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockGetSettings = getSettings as ReturnType<typeof vi.fn>;
const mockUpdateSettings = updateSettings as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;

function authenticatedSession() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticatedSession();
});

describe("GET /api/v1/admin/sso", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { GET } = await import("@/app/api/v1/admin/sso/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { GET } = await import("@/app/api/v1/admin/sso/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns SSO config with LDAP from the source table", async () => {
    mockCan.mockResolvedValue(true);
    mockGetSettings.mockResolvedValue({ url: "https://sso.example.com" });
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.ldapSource.findFirst).mockResolvedValue({
      id: "src-1", name: "corp.local", enabled: true, url: "ldaps://dc.corp.local",
      bindUpn: "svc@corp.local", bindPassword: "enc", upnSuffix: "@corp.local",
      searchBase: null, emailAttribute: "mail", nameAttribute: "cn", defaultRole: "member",
      syncIntervalHours: 12, tlsCaCert: null, lastSyncedAt: null, lastSyncError: null,
      deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    } as never);

    const { GET } = await import("@/app/api/v1/admin/sso/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("ldap");
    expect(body.data).toHaveProperty("saml");
  });
});

describe("PATCH /api/v1/admin/sso", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { PATCH } = await import("@/app/api/v1/admin/sso/route");
    const res = await PATCH(makeRequest("PATCH", { ldap: { url: "ldap://ldap.local" } }));
    expect(res.status).toBe(401);
  });

  it("upserts LDAP into the LdapSource table", async () => {
    mockCan.mockResolvedValue(true);
    mockGetSettings.mockResolvedValue({});
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.ldapSource.findFirst).mockResolvedValue({
      id: "src-1", name: "corp.local", enabled: true, url: "ldaps://dc.corp.local",
      bindUpn: "svc@corp.local", bindPassword: "enc", upnSuffix: "@corp.local",
      searchBase: null, emailAttribute: "mail", nameAttribute: "cn", defaultRole: "member",
      syncIntervalHours: 12, tlsCaCert: null, lastSyncedAt: null, lastSyncError: null,
      deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    } as never);

    const { PATCH } = await import("@/app/api/v1/admin/sso/route");
    const res = await PATCH(makeRequest("PATCH", { ldap: { url: "ldap://ldap.local", bindUpn: "svc@example.com", bindPassword: "secret" } }));

    expect(res.status).toBe(200);
    expect(prisma.ldapSource.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "src-1" },
      data: expect.objectContaining({ url: "ldap://ldap.local", bindUpn: "svc@example.com" }),
    }));
    expect(prisma.ldapSource.create).not.toHaveBeenCalled();
    expect(mockUpdateSettings).not.toHaveBeenCalledWith("install", null, expect.objectContaining({ ldap: expect.anything() }));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "settings", entityId: "sso" }),
    );
  });

  it("creates a new source when none exists", async () => {
    mockCan.mockResolvedValue(true);
    mockGetSettings.mockResolvedValue({});
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.ldapSource.findFirst).mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/v1/admin/sso/route");
    const res = await PATCH(makeRequest("PATCH", { ldap: { url: "ldap://ldap.local", bindUpn: "svc@example.com", bindPassword: "secret" } }));

    expect(res.status).toBe(200);
    expect(prisma.ldapSource.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ url: "ldap://ldap.local", bindUpn: "svc@example.com" }),
    }));
  });
});
