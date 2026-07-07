import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tag: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
  },
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
const { can } = await import("@/lib/rbac");
const { getSettings, updateSettings } = await import("@/lib/settings");
const { logAudit } = await import("@/lib/audit/log");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCan = can as ReturnType<typeof vi.fn>;
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

  it("returns SSO config", async () => {
    mockCan.mockResolvedValue(true);
    mockGetSettings.mockResolvedValue({ url: "https://sso.example.com" });

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

  it("saves LDAP settings to DB", async () => {
    mockCan.mockResolvedValue(true);
    mockGetSettings.mockResolvedValue({});

    const { PATCH } = await import("@/app/api/v1/admin/sso/route");
    const res = await PATCH(makeRequest("PATCH", { ldap: { url: "ldap://ldap.local", baseDN: "dc=ex,dc=com" } }));

    expect(res.status).toBe(200);
    expect(mockUpdateSettings).toHaveBeenCalledWith("install", null, { ldap: { url: "ldap://ldap.local", baseDN: "dc=ex,dc=com" } });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "settings", entityId: "sso" }),
    );
  });

  it("filters out empty string values", async () => {
    mockCan.mockResolvedValue(true);
    mockGetSettings.mockResolvedValue({});

    const { PATCH } = await import("@/app/api/v1/admin/sso/route");
    await PATCH(makeRequest("PATCH", { ldap: { url: "ldap://ldap.local", password: "" } }));

    expect(mockUpdateSettings).toHaveBeenCalledWith("install", null, { ldap: { url: "ldap://ldap.local" } });
  });
});
