import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockRequireAuth, mockRequirePermission, mockPrisma, mockCan, mockCanAccessDepartment, mockLogAudit } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockPrisma: {
    rateCard: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
  mockCan: vi.fn(),
  mockCanAccessDepartment: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: () => mockRequirePermission,
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/rbac/can", () => ({ can: mockCan, canAccessDepartment: mockCanAccessDepartment }));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));

import { GET, POST } from "@/app/api/v1/rate-cards/route";
import { handleTransition } from "@/lib/timesheets/transition-handler";
import { getPeriod, transitionPeriod } from "@/lib/timesheets";

vi.mock("@/lib/timesheets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/timesheets")>();
  return {
    ...actual,
    getPeriod: vi.fn(),
    transitionPeriod: vi.fn(),
  };
});

const mockGetPeriod = vi.mocked(getPeriod);
const mockTransitionPeriod = vi.mocked(transitionPeriod);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "admin-1" });
  mockRequirePermission.mockResolvedValue(null);
  mockLogAudit.mockResolvedValue(undefined);
  mockCanAccessDepartment.mockResolvedValue(true);
});

describe("GET /api/v1/rate-cards", () => {
  it("returns 403 when the user lacks timesheet.manage_rates", async () => {
    mockRequirePermission.mockResolvedValue(
      NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }),
    );
    const res = await GET(new Request("http://localhost/api/v1/rate-cards"));
    expect(res.status).toBe(403);
    expect(mockPrisma.rateCard.findMany).not.toHaveBeenCalled();
  });

  it("returns the rate cards for an authorized user", async () => {
    mockPrisma.rateCard.findMany.mockResolvedValue([{ id: "card-1", costRateMinor: 100 }]);
    const res = await GET(new Request("http://localhost/api/v1/rate-cards"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([{ id: "card-1", costRateMinor: 100 }]);
  });
});

describe("POST /api/v1/rate-cards", () => {
  it("rejects a user-scoped card without a userId", async () => {
    mockPrisma.rateCard.create.mockResolvedValue({ id: "card-1" });
    const res = await POST(
      new Request("http://localhost/api/v1/rate-cards", {
        method: "POST",
        body: JSON.stringify({ scope: "user", costRateMinor: 100, effectiveFrom: "2026-08-21T00:00:00.000Z" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.rateCard.create).not.toHaveBeenCalled();
  });

  it("creates a valid role-scoped card and audits it", async () => {
    mockPrisma.rateCard.create.mockResolvedValue({
      id: "card-1",
      scope: "role",
      roleType: "manager",
      costRateMinor: 5000,
      currency: "USD",
    });
    const res = await POST(
      new Request("http://localhost/api/v1/rate-cards", {
        method: "POST",
        body: JSON.stringify({
          scope: "role",
          roleType: "manager",
          costRateMinor: 5000,
          effectiveFrom: "2026-08-21T00:00:00.000Z",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.rateCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scope: "role", roleType: "manager", costRateMinor: 5000 }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rate_card_created", entityType: "rate_card" }),
    );
  });
});

describe("timesheet transition handler", () => {
  it("returns 403 when an approver-mode transition lacks timesheet.approve", async () => {
    mockCan.mockResolvedValue(false);
    const res = await handleTransition("approve", "approver", "user-1", "dept-1", "period-1");
    expect(res.status).toBe(403);
    expect(mockTransitionPeriod).not.toHaveBeenCalled();
  });

  it("returns 404 when the period is in another department", async () => {
    mockCan.mockResolvedValue(true);
    mockGetPeriod.mockResolvedValue({ departmentId: "other-dept", ownerId: "user-1" } as never);
    const res = await handleTransition("approve", "approver", "user-1", "dept-1", "period-1");
    expect(res.status).toBe(404);
  });
});
