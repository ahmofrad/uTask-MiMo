import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    organizationMembership: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { DEFAULT_ORGANIZATION_ID, ensureDefaultOrganizationMembership, getOrganizationContext, getRequestedOrganizationId } from "@/lib/organizations/context";

beforeEach(() => vi.clearAllMocks());

describe("organization context", () => {
  it("rejects an invalid requested organization ID", async () => {
    await expect(getOrganizationContext("user-1", "not-a-uuid")).resolves.toBeNull();
    expect(prisma.organizationMembership.findUnique).not.toHaveBeenCalled();
  });

  it("resolves only an existing membership", async () => {
    const organizationId = "11111111-1111-4111-8111-111111111111";
    vi.mocked(prisma.organizationMembership.findUnique).mockResolvedValue({ organizationId, role: "member" } as never);
    await expect(getOrganizationContext("user-1", organizationId)).resolves.toEqual({ organizationId, organizationRole: "member" });
  });

  it("uses the default organization when no header is present", async () => {
    const request = new Request("http://localhost");
    expect(getRequestedOrganizationId(request)).toBeNull();
    vi.mocked(prisma.organizationMembership.findUnique).mockResolvedValue({ organizationId: DEFAULT_ORGANIZATION_ID, role: "owner" } as never);
    await expect(getOrganizationContext("user-1")).resolves.toEqual({ organizationId: DEFAULT_ORGANIZATION_ID, organizationRole: "owner" });
  });

  it("backfills default membership for JIT users", async () => {
    await ensureDefaultOrganizationMembership("user-1");
    expect(prisma.organizationMembership.upsert).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: DEFAULT_ORGANIZATION_ID, userId: "user-1" } },
      create: { organizationId: DEFAULT_ORGANIZATION_ID, userId: "user-1", role: "member" },
      update: {},
    });
  });
});
