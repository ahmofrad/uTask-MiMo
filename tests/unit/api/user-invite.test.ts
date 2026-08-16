import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockSendMail = vi.fn();
const mockLogAudit = vi.fn();
const mockSignIn = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockTokenDeleteMany = vi.fn();
const mockTokenCreate = vi.fn();
const mockTokenFindUnique = vi.fn();
const mockTokenDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/mail/send", () => ({ sendMail: mockSendMail }));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/auth/config", () => ({ signIn: mockSignIn }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    verificationToken: {
      deleteMany: mockTokenDeleteMany,
      create: mockTokenCreate,
      findUnique: mockTokenFindUnique,
      delete: mockTokenDelete,
    },
    $transaction: mockTransaction,
  },
}));

const inviteRoute = await import("@/app/api/v1/users/[id]/invite/route");
const acceptRoute = await import("@/app/api/v1/auth/invite/[token]/route");

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function params(value: Record<string, string>) {
  return { params: Promise.resolve(value) };
}

function acceptRequest(body: Record<string, string>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) form.set(key, value);
  return new Request("http://localhost/api/v1/auth/invite/raw-token-12345678901234567890", {
    method: "POST",
    body: form,
  });
}

const ACCEPT_PARAMS = params({ token: "raw-token-12345678901234567890" });

function futureToken() {
  return { identifier: USER_ID, token: "stored-token-hash", expires: new Date(Date.now() + 60_000) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: ADMIN_ID });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
  mockSendMail.mockResolvedValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
  mockSignIn.mockResolvedValue({ error: undefined });
  mockTokenDeleteMany.mockResolvedValue({ count: 0 });
  mockTokenCreate.mockResolvedValue({});
  mockTokenDelete.mockResolvedValue({});
  mockTransaction.mockImplementation(async (operations: unknown[]) =>
    Promise.all(operations as Promise<unknown>[]),
  );
});

describe("POST /api/v1/users/[id]/invite", () => {
  it("denies users without user:manage", async () => {
    mockRequirePermission.mockReturnValue(
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    const response = await inviteRoute.POST(
      new Request("http://localhost/api/v1/users/xxx/invite", { method: "POST" }),
      params({ id: USER_ID }),
    );

    expect(response.status).toBe(403);
    expect(mockTokenCreate).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown user", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const response = await inviteRoute.POST(
      new Request("http://localhost/api/v1/users/xxx/invite", { method: "POST" }),
      params({ id: USER_ID }),
    );

    expect(response.status).toBe(404);
    expect(mockTokenCreate).not.toHaveBeenCalled();
  });

  it("rejects users who are not invited", async () => {
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, email: "x@utask.local", status: "active" });

    const response = await inviteRoute.POST(
      new Request("http://localhost/api/v1/users/xxx/invite", { method: "POST" }),
      params({ id: USER_ID }),
    );

    expect(response.status).toBe(400);
    expect(mockTokenCreate).not.toHaveBeenCalled();
  });

  it("stores a hashed token, emails the invite link, and audits", async () => {
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, email: "new@utask.local", status: "invited" });

    const response = await inviteRoute.POST(
      new Request("http://localhost/api/v1/users/xxx/invite", { method: "POST" }),
      params({ id: USER_ID }),
    );

    expect(response.status).toBe(200);
    const tokenData = mockTokenCreate.mock.calls[0]?.[0]?.data as {
      identifier: string;
      token: string;
      expires: Date;
    };
    expect(tokenData.identifier).toBe(USER_ID);
    expect(tokenData.token).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenData.expires.getTime()).toBeGreaterThan(Date.now());
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "new@utask.local",
      subject: expect.any(String),
      text: expect.stringContaining("/invite/"),
    }));
    expect(mockSendMail.mock.calls[0]?.[0].text).not.toContain(tokenData.token);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "invite_sent",
      actorUserId: ADMIN_ID,
      entityType: "user",
      entityId: USER_ID,
    }));
  });
});

describe("POST /api/v1/auth/invite/[token]", () => {
  it("activates the invited user and signs them in", async () => {
    mockTokenFindUnique.mockResolvedValue(futureToken());
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, email: "new@utask.local", status: "invited" });

    const response = await acceptRoute.POST(
      acceptRequest({ displayName: "Jane Doe", password: "new-password-1234" }),
      ACCEPT_PARAMS,
    );

    expect(response.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        displayName: "Jane Doe",
        passwordHash: expect.stringMatching(/^\$2/),
        status: "active",
      },
    });
    expect(mockTokenDelete).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "invite_accepted",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
    }));
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "new@utask.local",
      password: "new-password-1234",
      redirect: false,
    });
  });

  it("rejects an unknown token", async () => {
    mockTokenFindUnique.mockResolvedValue(null);

    const response = await acceptRoute.POST(
      acceptRequest({ displayName: "Jane Doe", password: "new-password-1234" }),
      ACCEPT_PARAMS,
    );

    expect(response.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    mockTokenFindUnique.mockResolvedValue({
      ...futureToken(),
      expires: new Date(Date.now() - 60_000),
    });

    const response = await acceptRoute.POST(
      acceptRequest({ displayName: "Jane Doe", password: "new-password-1234" }),
      ACCEPT_PARAMS,
    );

    expect(response.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects a token for a user who is not invited", async () => {
    mockTokenFindUnique.mockResolvedValue(futureToken());
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, email: "new@utask.local", status: "active" });

    const response = await acceptRoute.POST(
      acceptRequest({ displayName: "Jane Doe", password: "new-password-1234" }),
      ACCEPT_PARAMS,
    );

    expect(response.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
