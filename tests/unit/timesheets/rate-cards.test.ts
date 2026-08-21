import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    rateCard: { findFirst: vi.fn() },
    role: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { resolveCostRate } from "@/lib/timesheets/rate-cards";

const AT = new Date("2026-08-21T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveCostRate", () => {
  it("prefers a user-scoped rate card over a role card", async () => {
    mockPrisma.rateCard.findFirst.mockResolvedValueOnce({ costRateMinor: 5500, currency: "USD" });

    const rate = await resolveCostRate("u1", AT);
    expect(rate).toEqual({ costRateMinor: 5500, currency: "USD" });
    // Should never query the role card path.
    expect(mockPrisma.role.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to the user's global role rate card", async () => {
    mockPrisma.rateCard.findFirst
      .mockResolvedValueOnce(null) // no user card
      .mockResolvedValueOnce({ costRateMinor: 4200, currency: "EUR" }); // role card
    mockPrisma.role.findFirst.mockResolvedValue({ type: "manager" });

    const rate = await resolveCostRate("u1", AT);
    expect(rate).toEqual({ costRateMinor: 4200, currency: "EUR" });
    expect(mockPrisma.rateCard.findFirst).toHaveBeenCalledTimes(2);
    expect(mockPrisma.role.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", scopeType: "global", scopeId: null },
      select: { type: true },
    });
  });

  it("returns a zero-rate USD fallback when no card applies", async () => {
    mockPrisma.rateCard.findFirst.mockResolvedValue(null);
    mockPrisma.role.findFirst.mockResolvedValue(null);

    const rate = await resolveCostRate("u1", AT);
    expect(rate).toEqual({ costRateMinor: 0, currency: "USD" });
  });

  it("queries the correct effective window", async () => {
    mockPrisma.rateCard.findFirst.mockResolvedValue({ costRateMinor: 100, currency: "USD" });

    await resolveCostRate("u1", AT);
    expect(mockPrisma.rateCard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scope: "user",
          userId: "u1",
          effectiveFrom: { lte: AT },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: AT } }],
        },
      }),
    );
  });
});
