import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    organizationMembership: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { getOrganizationContext, getRequestedOrganizationId, ensureDefaultOrganizationMembership, DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";
import { prisma } from "@/lib/db";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrganizationContext", () => {
  it("returns default organization when no header specified", async () => {
    mockPrisma.organizationMembership.findUnique.mockResolvedValue({
      organizationId: DEFAULT_ORGANIZATION_ID,
      role: "member",
    } as never);

    const result = await getOrganizationContext("user-1");
    expect(result).toEqual({
      organizationId: DEFAULT_ORGANIZATION_ID,
      organizationRole: "member",
    });
  });

  it("returns null for non-member users", async () => {
    mockPrisma.organizationMembership.findUnique.mockResolvedValue(null);

    const result = await getOrganizationContext("user-1", "11111111-1111-4111-8111-111111111111");
    expect(result).toBeNull();
  });

  it("returns the correct role", async () => {
    mockPrisma.organizationMembership.findUnique.mockResolvedValue({
      organizationId: "11111111-1111-4111-8111-111111111111",
      role: "admin",
    } as never);

    const result = await getOrganizationContext("user-1", "11111111-1111-4111-8111-111111111111");
    expect(result?.organizationRole).toBe("admin");
  });

  it("rejects invalid UUID organization IDs", async () => {
    const result = await getOrganizationContext("user-1", "not-a-uuid");
    expect(result).toBeNull();
    expect(mockPrisma.organizationMembership.findUnique).not.toHaveBeenCalled();
  });

  it("uses default org when requested org is null", async () => {
    mockPrisma.organizationMembership.findUnique.mockResolvedValue({
      organizationId: DEFAULT_ORGANIZATION_ID,
      role: "owner",
    } as never);

    const result = await getOrganizationContext("user-1", null);
    expect(result?.organizationId).toBe(DEFAULT_ORGANIZATION_ID);
  });
});

describe("getRequestedOrganizationId", () => {
  it("extracts organization id from header", () => {
    const req = new Request("http://localhost", {
      headers: { "x-organization-id": "org-1" },
    });
    expect(getRequestedOrganizationId(req)).toBe("org-1");
  });

  it("returns null when header is missing", () => {
    const req = new Request("http://localhost");
    expect(getRequestedOrganizationId(req)).toBeNull();
  });

  it("trims whitespace", () => {
    const req = new Request("http://localhost", {
      headers: { "x-organization-id": "  org-1  " },
    });
    expect(getRequestedOrganizationId(req)).toBe("org-1");
  });
});

describe("ensureDefaultOrganizationMembership", () => {
  it("upserts membership for the default org", async () => {
    mockPrisma.organizationMembership.upsert.mockResolvedValue({} as never);

    await ensureDefaultOrganizationMembership("user-1");

    expect(mockPrisma.organizationMembership.upsert).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: DEFAULT_ORGANIZATION_ID, userId: "user-1" } },
      create: { organizationId: DEFAULT_ORGANIZATION_ID, userId: "user-1", role: "member" },
      update: {},
    });
  });
});
