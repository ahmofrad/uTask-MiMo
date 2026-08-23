import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
const mockCan = vi.fn();
const mockCanProject = vi.fn();
vi.mock("@/lib/rbac", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/rbac/can", () => ({ can: mockCan, canProject: mockCanProject }));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tag: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
    webhook: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/webhook/emit", () => ({ emitTaskEvent: vi.fn() }));
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: vi.fn(() => ({ hit: false })),
  setIdempotencyResult: vi.fn(),
}));
vi.mock("@/lib/crypto", () => ({
  randomHex: vi.fn(() => "aabbccddee00112233445566778899aabbccddee00112233445566778899"),
}));
vi.mock("@/lib/crypto/encrypt", () => ({
  encrypt: vi.fn(() => ({ iv: "iv123", ciphertext: "ct456", tag: "tag789" })),
}));
vi.mock("@/lib/webhook", () => ({
  validateWebhookUrl: vi.fn(),
  validateWebhookUrlResolved: vi.fn(),
}));

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/v1/webhooks", init);
}

const { auth } = await import("@/lib/auth/config");
const { prisma } = await import("@/lib/db");
const { validateWebhookUrl, validateWebhookUrlResolved } = await import("@/lib/webhook");
const { logAudit } = await import("@/lib/audit/log");

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockWebhookCreate = (prisma.webhook.create as ReturnType<typeof vi.fn>);
const mockWebhookFindFirst = (prisma.webhook.findFirst as ReturnType<typeof vi.fn>);
const mockWebhookUpdate = (prisma.webhook.update as ReturnType<typeof vi.fn>);
const mockValidateUrl = validateWebhookUrl as ReturnType<typeof vi.fn>;
const mockValidateUrlResolved = validateWebhookUrlResolved as ReturnType<typeof vi.fn>;
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;

function authenticatedSession() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  mockWebhookFindFirst.mockResolvedValue({
    id: "wh1",
    name: "old",
    url: "https://example.com/old",
    events: ["task.created"],
    active: true,
    secret: "encrypted-secret",
    deletedAt: null,
  });
  mockWebhookUpdate.mockResolvedValue({
    id: "wh1",
    name: "new",
    url: "https://example.com/old",
    events: ["task.created"],
    active: true,
    secret: "encrypted-secret",
    deletedAt: null,
  });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticatedSession();
});

describe("POST /api/v1/webhooks", () => {
  it("returns 401 when unauthenticated", async () => {
    unauthenticatedSession();
    const { POST } = await import("@/app/api/v1/webhooks/route");
    const res = await POST(makeRequest("POST", { name: "wh", url: "https://example.com", events: ["task.created"] }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when can denies", async () => {
    mockCan.mockResolvedValue(false);
    const { POST } = await import("@/app/api/v1/webhooks/route");
    const res = await POST(makeRequest("POST", { name: "wh", url: "https://example.com", events: ["task.created"] }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields missing", async () => {
    mockCan.mockResolvedValue(true);
    const { POST } = await import("@/app/api/v1/webhooks/route");
    const res = await POST(makeRequest("POST", { name: "wh" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid webhook URL", async () => {
    mockCan.mockResolvedValue(true);
    mockValidateUrl.mockReturnValue(false);
    mockValidateUrlResolved.mockResolvedValue(false);

    const { POST } = await import("@/app/api/v1/webhooks/route");
    const res = await POST(makeRequest("POST", { name: "wh", url: "http://10.0.0.1/hook", events: ["task.created"] }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates webhook with encrypted secret", async () => {
    mockCan.mockResolvedValue(true);
    mockValidateUrl.mockReturnValue(true);
    mockValidateUrlResolved.mockResolvedValue(true);
    mockWebhookCreate.mockResolvedValue({ id: "wh1", name: "wh", url: "https://example.com", events: ["task.created"], secret: "encrypted-secret" });

    const { POST } = await import("@/app/api/v1/webhooks/route");
    const res = await POST(makeRequest("POST", { name: "wh", url: "https://example.com/hook", events: ["task.created"] }));

    expect(res.status).toBe(201);
    expect(mockWebhookCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          secret: expect.stringContaining("iv123"),
        }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "webhook_created" }),
    );
  });
});

describe("PATCH /api/v1/webhooks/:id", () => {
  it("does not expose the encrypted secret", async () => {
    mockCan.mockResolvedValue(true);
    const { PATCH } = await import("@/app/api/v1/webhooks/[id]/route");
    const response = await PATCH(makeRequest("PATCH", { name: "new" }), {
      params: Promise.resolve({ id: "wh1" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.secret).toBeUndefined();
    expect(body.data.name).toBe("new");
  });
});
