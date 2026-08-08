import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  verificationToken: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
};
const mockSendMail = vi.fn();
const mockLogAudit = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/mail/send", () => ({ sendMail: mockSendMail }));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(body: Record<string, string>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) form.set(key, value);
  return new Request("http://localhost/api/v1/auth/reset-password", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.verificationToken.create.mockResolvedValue({});
  mockPrisma.verificationToken.delete.mockResolvedValue({});
  mockPrisma.user.update.mockResolvedValue({});
  mockPrisma.$transaction.mockImplementation(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[]));
  mockSendMail.mockResolvedValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/v1/auth/forgot-password", () => {
  it("returns a generic success response for an unknown email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/v1/auth/forgot-password/route");

    const response = await POST(jsonRequest({ email: "unknown@example.com" }));

    expect(response.status).toBe(200);
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("stores a hashed token, sends the reset URL, and audits known users", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", email: "admin@utask.local", status: "active" });
    const { POST } = await import("@/app/api/v1/auth/forgot-password/route");

    const response = await POST(jsonRequest({ email: " ADMIN@UTASK.LOCAL " }));
    const tokenData = mockPrisma.verificationToken.create.mock.calls[0]?.[0]?.data as { identifier: string; token: string; expires: Date };

    expect(response.status).toBe(200);
    expect(tokenData.identifier).toBe("11111111-1111-4111-8111-111111111111");
    expect(tokenData.token).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenData.expires.getTime()).toBeGreaterThan(Date.now());
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "admin@utask.local",
      subject: expect.any(String),
      text: expect.stringContaining("/reset-password/"),
    }));
    expect(mockSendMail.mock.calls[0]?.[0].text).not.toContain(tokenData.token);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "password_reset_requested",
      actorUserId: "11111111-1111-4111-8111-111111111111",
    }));
  });

  it("keeps a generic response when delivery fails", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", email: "admin@utask.local", status: "active" });
    mockSendMail.mockRejectedValueOnce(new Error("smtp unavailable"));
    const { POST } = await import("@/app/api/v1/auth/forgot-password/route");

    const response = await POST(jsonRequest({ email: "admin@utask.local" }));

    expect(response.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "password_reset_requested" }));
  });
});

describe("POST /api/v1/auth/reset-password", () => {
  it("updates the password and consumes a valid reset token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      identifier: "11111111-1111-4111-8111-111111111111",
      token: "stored-token-hash",
      expires: new Date(Date.now() + 60_000),
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", status: "active" });
    const { POST } = await import("@/app/api/v1/auth/reset-password/route");

    const response = await POST(formRequest({ token: "raw-reset-token-12345678901234567890", password: "new-password-1234", confirmPassword: "new-password-1234" }));

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "11111111-1111-4111-8111-111111111111" },
      data: { passwordHash: expect.stringMatching(/^\$2/) },
    });
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "password_changed",
      actorUserId: "11111111-1111-4111-8111-111111111111",
    }));
  });

  it("rejects an expired token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      identifier: "11111111-1111-4111-8111-111111111111",
      token: "stored-token-hash",
      expires: new Date(Date.now() - 60_000),
    });
    const { POST } = await import("@/app/api/v1/auth/reset-password/route");

    const response = await POST(formRequest({ token: "raw-reset-token-12345678901234567890", password: "new-password-1234", confirmPassword: "new-password-1234" }));

    expect(response.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
