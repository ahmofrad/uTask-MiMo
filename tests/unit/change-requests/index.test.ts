import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    changeRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/baselines", () => ({
  captureBaseline: vi.fn().mockResolvedValue({ id: "baseline-1" }),
}));

import {
  createChangeRequest,
  transitionChangeRequest,
  listChangeRequests,
  deleteChangeRequest,
  type ChangeRequestData,
} from "@/lib/change-requests";
import { prisma } from "@/lib/db";

const mockPrisma = vi.mocked(prisma);

function fakeCr(overrides: Partial<ChangeRequestData> = {}): ChangeRequestData {
  return {
    id: "cr-1",
    projectId: "proj-1",
    reference: "CR-001",
    title: "Test CR",
    description: null,
    status: "DRAFT",
    scheduleDeltaDays: null,
    costImpactMinor: null,
    costCurrency: null,
    submittedById: null,
    submittedAt: null,
    decidedById: null,
    decidedAt: null,
    baselineId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createChangeRequest", () => {
  it("generates sequential reference numbers", async () => {
    mockPrisma.changeRequest.findFirst.mockResolvedValue({ reference: "CR-003" } as never);
    mockPrisma.changeRequest.create.mockResolvedValue(fakeCr({ reference: "CR-004" }) as never);

    const result = await createChangeRequest("proj-1", "team-1", "user-1", { title: "New CR" });
    expect(result.reference).toBe("CR-004");
  });

  it("starts at CR-001 for new projects", async () => {
    mockPrisma.changeRequest.findFirst.mockResolvedValue(null);
    mockPrisma.changeRequest.create.mockResolvedValue(fakeCr({ reference: "CR-001" }) as never);

    const result = await createChangeRequest("proj-1", "team-1", "user-1", { title: "First CR" });
    expect(result.reference).toBe("CR-001");
  });
});

describe("transitionChangeRequest", () => {
  it("allows DRAFT → SUBMITTED", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue(fakeCr() as never);
    mockPrisma.changeRequest.update.mockResolvedValue(fakeCr({ status: "SUBMITTED" }) as never);

    await transitionChangeRequest("cr-1", "proj-1", "user-1", "SUBMITTED");
    expect(mockPrisma.changeRequest.update).toHaveBeenCalled();
  });

  it("rejects DRAFT → APPROVED", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue(fakeCr() as never);

    await expect(
      transitionChangeRequest("cr-1", "proj-1", "user-1", "APPROVED"),
    ).rejects.toThrow("INVALID_TRANSITION");
  });

  it("throws CR_NOT_FOUND for missing CR", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue(null);

    await expect(
      transitionChangeRequest("missing", "proj-1", "user-1", "SUBMITTED"),
    ).rejects.toThrow("CR_NOT_FOUND");
  });

  it("throws CR_NOT_FOUND if projectId mismatches", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue(fakeCr({ projectId: "other" }) as never);

    await expect(
      transitionChangeRequest("cr-1", "proj-1", "user-1", "SUBMITTED"),
    ).rejects.toThrow("CR_NOT_FOUND");
  });

  it("creates baseline on APPLIED transition", async () => {
    const { captureBaseline } = await import("@/lib/baselines");
    mockPrisma.changeRequest.findUnique.mockResolvedValue(fakeCr({ status: "APPROVED" }) as never);
    mockPrisma.changeRequest.update.mockResolvedValue(fakeCr({ status: "APPLIED" }) as never);

    await transitionChangeRequest("cr-1", "proj-1", "user-1", "APPLIED");
    expect(captureBaseline).toHaveBeenCalledWith("proj-1", "CR CR-001: Test CR", "user-1", "CHANGE_REQUEST");
  });
});

describe("listChangeRequests", () => {
  it("filters by status", async () => {
    mockPrisma.changeRequest.findMany.mockResolvedValue([fakeCr({ status: "SUBMITTED" })] as never);

    const result = await listChangeRequests("proj-1", { status: "SUBMITTED" });
    expect(result).toHaveLength(1);
    expect(mockPrisma.changeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SUBMITTED" }),
      }),
    );
  });

  it("lists all when no status filter", async () => {
    mockPrisma.changeRequest.findMany.mockResolvedValue([] as never);

    await listChangeRequests("proj-1");
    expect(mockPrisma.changeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});

describe("deleteChangeRequest", () => {
  it("allows deleting DRAFT CRs", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue(fakeCr() as never);
    mockPrisma.changeRequest.update.mockResolvedValue({} as never);

    await deleteChangeRequest("cr-1", "proj-1", "user-1");
    expect(mockPrisma.changeRequest.update).toHaveBeenCalled();
  });

  it("rejects deleting non-DRAFT CRs", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue(fakeCr({ status: "SUBMITTED" }) as never);

    await expect(
      deleteChangeRequest("cr-1", "proj-1", "user-1"),
    ).rejects.toThrow("CR_NOT_DELETABLE");
  });

  it("throws for missing CR", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue(null);

    await expect(
      deleteChangeRequest("missing", "proj-1", "user-1"),
    ).rejects.toThrow("CR_NOT_FOUND");
  });
});
