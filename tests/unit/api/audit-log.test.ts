import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockRequireAuth, mockRequirePermission, mockListAuditLogs } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequirePermission: vi.fn(() => async () => null),
  mockListAuditLogs: vi.fn(),
}));

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/audit-log", () => ({ listAuditLogs: mockListAuditLogs }));

import { GET } from "@/app/api/v1/audit-log/route";

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { id: "admin-1" } });
  mockListAuditLogs.mockResolvedValue({ data: [], meta: { hasMore: false } });
});

describe("GET /api/v1/audit-log", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }),
    );
    const res = await GET(makeRequest("http://localhost/api/v1/audit-log"));
    expect(res.status).toBe(401);
    expect(mockListAuditLogs).not.toHaveBeenCalled();
  });

  it("returns 403 when permission denied", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user-1" });
    mockRequirePermission.mockReturnValueOnce(
      async () => NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }),
    );
    const res = await GET(makeRequest("http://localhost/api/v1/audit-log"));
    expect(res.status).toBe(403);
    expect(mockListAuditLogs).not.toHaveBeenCalled();
  });

  it("passes groupAccess=true through to the lib", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/v1/audit-log?groupAccess=true&limit=25"),
    );
    expect(res.status).toBe(200);
    expect(mockListAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ groupAccess: true, limit: 25 }),
    );
  });

  it("omits groupAccess when not requested", async () => {
    await GET(makeRequest("http://localhost/api/v1/audit-log"));
    expect(mockListAuditLogs).toHaveBeenCalledWith(
      expect.not.objectContaining({ groupAccess: true }),
    );
  });

  it("passes entityType and action filters through", async () => {
    await GET(
      makeRequest("http://localhost/api/v1/audit-log?entityType=group&action=group_member_added"),
    );
    expect(mockListAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "group", action: "group_member_added" }),
    );
  });

  it("caps limit at 200", async () => {
    await GET(makeRequest("http://localhost/api/v1/audit-log?limit=9999"));
    expect(mockListAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
  });
});
