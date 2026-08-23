import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockListUserSessions, mockGetSession, mockRevokeSession, mockLogAudit } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockListUserSessions: vi.fn(),
  mockGetSession: vi.fn(),
  mockRevokeSession: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock("@/lib/auth/config", () => ({ auth: mockAuth }));
vi.mock("@/lib/auth/session-store", () => ({
  listUserSessions: mockListUserSessions,
  getSession: mockGetSession,
  revokeSession: mockRevokeSession,
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

import { GET } from "@/app/api/v1/auth/sessions/route";
import { DELETE } from "@/app/api/v1/auth/sessions/[id]/route";

const ADMIN = { user: { id: "user-1" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(ADMIN);
});

describe("GET /api/v1/auth/sessions", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockListUserSessions).not.toHaveBeenCalled();
  });

  it("returns the current user's sessions as ISO strings", async () => {
    mockListUserSessions.mockResolvedValue([
      {
        id: "session-1",
        createdAt: 1_700_000_000_000,
        lastUsedAt: 1_700_000_001_000,
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockListUserSessions).toHaveBeenCalledWith("user-1");
    const json = await res.json();
    expect(json.data).toEqual([
      {
        id: "session-1",
        createdAt: new Date(1_700_000_000_000).toISOString(),
        lastUsedAt: new Date(1_700_000_001_000).toISOString(),
      },
    ]);
  });

  it("returns an empty array when the user has no active sessions", async () => {
    mockListUserSessions.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });
});

describe("DELETE /api/v1/auth/sessions/:id", () => {
  function del(id: string): Promise<Response> {
    return DELETE(
      new Request(`http://localhost/api/v1/auth/sessions/${id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id }) },
    );
  }

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await del("session-1");
    expect(res.status).toBe(401);
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it("returns 404 when the session does not exist", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await del("missing");
    expect(res.status).toBe(404);
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it("returns 404 when the session belongs to another user", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-2" });
    const res = await del("session-1");
    expect(res.status).toBe(404);
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it("revokes the caller's own session and returns success", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    mockRevokeSession.mockResolvedValue(undefined);
    const res = await del("session-1");
    expect(res.status).toBe(200);
    expect(mockRevokeSession).toHaveBeenCalledWith("session-1");
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "session_revoked", entityId: "session-1" }));
    const json = await res.json();
    expect(json.data).toEqual({ success: true });
  });
});