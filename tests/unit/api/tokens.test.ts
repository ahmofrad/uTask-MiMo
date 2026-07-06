import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ can: vi.fn(), canProject: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tag: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
    apiToken: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/webhook/emit", () => ({ emitTaskEvent: vi.fn() }));
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => ({ hit: false })),
  setIdempotencyResult: vi.fn(),
}));
vi.mock("@/lib/api-token", () => ({
  createApiToken: vi.fn(),
}));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/tokens", init);
}

const { auth } = await import("@/lib/auth/config");
const { prisma } = await import("@/lib/db");
const { createApiToken } = await import("@/lib/api-token");
const { logAudit } = await import("@/lib/audit/log");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockTokenFindMany = (prisma.apiToken.findMany as ReturnType<typeof vi.fn>);
const mockCreateApiToken = createApiToken as ReturnType<typeof vi.fn>;
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

describe("POST /api/v1/tokens", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/tokens/route");
    const res = await POST(makeRequest("POST", { name: "my-token", scopes: ["tasks:read"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/v1/tokens/route");
    const res = await POST(makeRequest("POST", { scopes: ["tasks:read"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when scopes is missing", async () => {
    const { POST } = await import("@/app/api/v1/tokens/route");
    const res = await POST(makeRequest("POST", { name: "my-token" }));
    expect(res.status).toBe(400);
  });

  it("creates token and logs audit", async () => {
    mockCreateApiToken.mockResolvedValue({ raw: "tk_abc", prefix: "tk_a", id: "tok-1" });

    const { POST } = await import("@/app/api/v1/tokens/route");
    const res = await POST(makeRequest("POST", { name: "my-token", scopes: ["tasks:read"] }));

    expect(res.status).toBe(201);
    expect(mockCreateApiToken).toHaveBeenCalledWith(
      expect.objectContaining({ name: "my-token", scopes: ["tasks:read"] }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "api_token_created", entityType: "api_token" }),
    );
  });
});

describe("GET /api/v1/tokens", () => {
  it("returns user tokens", async () => {
    mockTokenFindMany.mockResolvedValue([{ id: "tok-1", name: "my-token" }]);
    const { GET } = await import("@/app/api/v1/tokens/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});
