import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
const mockCanManageGroup = vi.fn();
const mockFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockLogAudit = vi.fn();
const mockAddGroupMember = vi.fn();
const mockRemoveGroupMember = vi.fn();
const mockListGroupMembers = vi.fn();
const mockCheckIdempotency = vi.fn();
const mockSetIdempotencyResult = vi.fn();
const mockAcquirePending = vi.fn();
const mockReleasePending = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/rbac", () => ({ canManageGroup: mockCanManageGroup }));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/groups", () => ({
  addGroupMember: mockAddGroupMember,
  removeGroupMember: mockRemoveGroupMember,
  listGroupMembers: mockListGroupMembers,
}));
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: mockCheckIdempotency,
  setIdempotencyResult: mockSetIdempotencyResult,
  acquirePending: mockAcquirePending,
  releasePending: mockReleasePending,
}));
vi.mock("@/lib/crypto", () => ({ sha256: vi.fn((v: string) => `hash:${v}`) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    ldapSyncGroup: { findUnique: mockFindUnique },
    user: { findUnique: mockUserFindUnique },
  },
}));

const { GET, POST } = await import("@/app/api/v1/groups/[id]/members/route");
const { DELETE } = await import("@/app/api/v1/groups/[id]/members/[userId]/route");

function request(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/v1/groups/group-1/members", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" },
  });
}

const groupParams = { params: Promise.resolve({ id: "group-1" }) };
const memberParams = { params: Promise.resolve({ id: "group-1", userId: "user-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockCanManageGroup.mockResolvedValue(true);
  mockFindUnique.mockResolvedValue({ id: "group-1", deletedAt: null });
  mockUserFindUnique.mockResolvedValue({ id: "00000000-0000-4000-8000-0000000000a1", status: "active" });
  mockListGroupMembers.mockResolvedValue([
    { id: "user-1", displayName: "Alice", email: "alice@company.local" },
  ]);
  mockAddGroupMember.mockResolvedValue({
    membership: { userId: "00000000-0000-4000-8000-0000000000a1", ldapSyncGroupId: "group-1" },
    created: true,
  });
  mockRemoveGroupMember.mockResolvedValue({ userId: "00000000-0000-4000-8000-0000000000a1", ldapSyncGroupId: "group-1" });
  mockCheckIdempotency.mockResolvedValue({ hit: false, unavailable: false });
  mockAcquirePending.mockResolvedValue("acquired");
  mockReleasePending.mockResolvedValue(undefined);
});

describe("GET /api/v1/groups/[id]/members", () => {
  it("lists members of a group", async () => {
    const response = await GET(request("GET"), groupParams);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ email: "alice@company.local" });
  });

  it("returns 404 for a missing or archived group", async () => {
    mockFindUnique.mockResolvedValue(null);
    const response = await GET(request("GET"), groupParams);
    expect(response.status).toBe(404);
  });

  it("denies without canManageGroup", async () => {
    mockCanManageGroup.mockResolvedValue(false);
    const response = await GET(request("GET"), groupParams);
    expect(response.status).toBe(403);
  });
});

describe("POST /api/v1/groups/[id]/members", () => {
  it("adds a member with an idempotency key", async () => {
    const response = await POST(request("POST", { userId: "00000000-0000-4000-8000-0000000000a1" }), groupParams);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ userId: "00000000-0000-4000-8000-0000000000a1" });
    expect(body.alreadyMember).toBeUndefined();
    expect(mockAddGroupMember).toHaveBeenCalledWith("group-1", "00000000-0000-4000-8000-0000000000a1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "group_member_added", entityId: "group-1" }),
    );
    expect(mockSetIdempotencyResult).toHaveBeenCalled();
  });

  it("returns 200 with alreadyMember when the user is already in the group", async () => {
    mockAddGroupMember.mockResolvedValue({
      membership: { userId: "00000000-0000-4000-8000-0000000000a1", ldapSyncGroupId: "group-1" },
      created: false,
    });
    const response = await POST(request("POST", { userId: "00000000-0000-4000-8000-0000000000a1" }), groupParams);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alreadyMember).toBe(true);
    expect(mockLogAudit).not.toHaveBeenCalled();
    expect(mockSetIdempotencyResult).toHaveBeenCalledWith(
      "key-1",
      200,
      expect.objectContaining({ alreadyMember: true }),
      expect.anything(),
    );
  });

  it("requires an idempotency key", async () => {
    const response = await POST(new Request("http://localhost/api/v1/groups/group-1/members", {
      method: "POST",
      body: JSON.stringify({ userId: "00000000-0000-4000-8000-0000000000a1" }),
      headers: { "Content-Type": "application/json" },
    }), groupParams);
    expect(response.status).toBe(400);
  });

  it("rejects an idempotency key reused with a different body", async () => {
    mockCheckIdempotency.mockResolvedValue({ hit: false, conflict: true, unavailable: false });
    const response = await POST(request("POST", { userId: "00000000-0000-4000-8000-0000000000a1" }), groupParams);
    expect(response.status).toBe(409);
  });

  it("returns 404 for a missing group", async () => {
    mockFindUnique.mockResolvedValue(null);
    const response = await POST(request("POST", { userId: "00000000-0000-4000-8000-0000000000a1" }), groupParams);
    expect(response.status).toBe(404);
  });

  it("denies without canManageGroup", async () => {
    mockCanManageGroup.mockResolvedValue(false);
    const response = await POST(request("POST", { userId: "00000000-0000-4000-8000-0000000000a1" }), groupParams);
    expect(response.status).toBe(403);
  });

  it("validates the body", async () => {
    const response = await POST(request("POST", { userId: "not-a-uuid" }), groupParams);
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/v1/groups/[id]/members/[userId]", () => {
  it("removes a member", async () => {
    const response = await DELETE(new Request("http://localhost/api/v1/groups/group-1/members/user-1", { method: "DELETE" }), memberParams);
    expect(response.status).toBe(200);
    expect(mockRemoveGroupMember).toHaveBeenCalledWith("group-1", "user-1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "group_member_removed", entityId: "group-1" }),
    );
  });

  it("returns 404 when the user is not a member", async () => {
    mockRemoveGroupMember.mockResolvedValue(null);
    const response = await DELETE(new Request("http://localhost/api/v1/groups/group-1/members/user-1", { method: "DELETE" }), memberParams);
    expect(response.status).toBe(404);
  });

  it("returns 404 for a missing group", async () => {
    mockFindUnique.mockResolvedValue(null);
    const response = await DELETE(new Request("http://localhost/api/v1/groups/group-1/members/user-1", { method: "DELETE" }), memberParams);
    expect(response.status).toBe(404);
  });

  it("denies without canManageGroup", async () => {
    mockCanManageGroup.mockResolvedValue(false);
    const response = await DELETE(new Request("http://localhost/api/v1/groups/group-1/members/user-1", { method: "DELETE" }), memberParams);
    expect(response.status).toBe(403);
  });
});
