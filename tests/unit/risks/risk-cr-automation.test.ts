import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

const mockPrisma = {
  riskRecord: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  changeRequest: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  automationRule: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  automationCondition: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  automationAction: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  automationTriggerEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  automationRun: {
    create: vi.fn(),
  },
  task: {
    update: vi.fn(),
    findMany: vi.fn(),
  },
  comment: {
    create: vi.fn(),
  },
  $transaction: vi.fn((f: unknown) => (typeof f === "function" ? f(mockPrisma) : f)),
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/baselines", () => ({
  captureBaseline: vi.fn().mockResolvedValue({ id: "baseline-1", name: "CR test" }),
}));

// ── Risk tests ──

describe("Risk register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createRisk generates sequential reference", async () => {
    mockPrisma.riskRecord.findFirst.mockResolvedValue(null);
    mockPrisma.riskRecord.create.mockResolvedValue({
      id: "r1",
      projectId: "p1",
      reference: "RISK-001",
      title: "Test risk",
      probability: 3,
      impact: 4,
      score: 12,
      response: "MITIGATE",
      status: "OPEN",
      owner: null,
    });

    const { createRisk } = await import("@/lib/risks");
    const risk = await createRisk("p1", "t1", "u1", {
      title: "Test risk",
      probability: 3,
      impact: 4,
    });

    expect(risk.reference).toBe("RISK-001");
    expect(risk.score).toBe(12);
    expect(mockPrisma.riskRecord.create).toHaveBeenCalled();
  });

  it("createRisk continues sequence from last reference", async () => {
    mockPrisma.riskRecord.findFirst.mockResolvedValue({ reference: "RISK-042" });
    mockPrisma.riskRecord.create.mockResolvedValue({
      id: "r2", projectId: "p1", reference: "RISK-043",
      title: "Another", probability: 1, impact: 1, score: 1,
      response: "ACCEPT", status: "OPEN", owner: null,
    });

    const { createRisk } = await import("@/lib/risks");
    const risk = await createRisk("p1", "t1", "u1", { title: "Another" });
    expect(risk.reference).toBe("RISK-043");
  });

  it("updateRisk computes score from probability × impact", async () => {
    mockPrisma.riskRecord.findUnique.mockResolvedValue({
      id: "r1", projectId: "p1", probability: 2, impact: 2, status: "OPEN", closedAt: null,
    });
    mockPrisma.riskRecord.update.mockResolvedValue({
      id: "r1", projectId: "p1", probability: 5, impact: 4, score: 20,
      status: "MONITORING", owner: null,
    });

    const { updateRisk } = await import("@/lib/risks");
    const risk = await updateRisk("r1", "p1", "u1", {
      probability: 5,
      impact: 4,
      status: "MONITORING",
    });
    expect(risk.score).toBe(20);
  });

  it("updateRisk throws if risk not found", async () => {
    mockPrisma.riskRecord.findUnique.mockResolvedValue(null);
    const { updateRisk } = await import("@/lib/risks");
    await expect(updateRisk("x", "p1", "u1", { title: "nope" }))
      .rejects.toThrow("RISK_NOT_FOUND");
  });

  it("listRisks filters by status and minScore", async () => {
    mockPrisma.riskRecord.findMany.mockResolvedValue([]);
    const { listRisks } = await import("@/lib/risks");
    await listRisks("p1", { status: "OPEN", minScore: 10 });
    expect(mockPrisma.riskRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "OPEN",
          score: { gte: 10 },
        }),
      }),
    );
  });

  it("deleteRisk soft-deletes", async () => {
    mockPrisma.riskRecord.findUnique.mockResolvedValue({ id: "r1", projectId: "p1" });
    mockPrisma.riskRecord.update.mockResolvedValue({});
    const { deleteRisk } = await import("@/lib/risks");
    await deleteRisk("r1", "p1", "u1");
    expect(mockPrisma.riskRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });
});

// ── Change request tests ──

describe("Change requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createChangeRequest generates sequential CR reference", async () => {
    mockPrisma.changeRequest.findFirst.mockResolvedValue(null);
    mockPrisma.changeRequest.create.mockResolvedValue({
      id: "cr1", projectId: "p1", reference: "CR-001", title: "Test CR",
      status: "DRAFT", submittedBy: null, decidedBy: null,
    });

    const { createChangeRequest } = await import("@/lib/change-requests");
    const cr = await createChangeRequest("p1", "t1", "u1", { title: "Test CR" });
    expect(cr.reference).toBe("CR-001");
    expect(cr.status).toBe("DRAFT");
  });

  it("transition to SUBMITTED sets submittedById and submittedAt", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue({
      id: "cr1", projectId: "p1", status: "DRAFT", baselineId: null,
    });
    mockPrisma.changeRequest.update.mockResolvedValue({
      id: "cr1", projectId: "p1", reference: "CR-001", title: "CR",
      status: "SUBMITTED", submittedById: "u1", submittedAt: new Date(),
      decidedById: null, decidedAt: null, baselineId: null,
      submittedBy: { id: "u1", displayName: "User" }, decidedBy: null,
    });

    const { transitionChangeRequest } = await import("@/lib/change-requests");
    const cr = await transitionChangeRequest("cr1", "p1", "u1", "SUBMITTED");
    expect(cr.status).toBe("SUBMITTED");
  });

  it("transition rejects invalid state change", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue({
      id: "cr1", projectId: "p1", status: "DRAFT", baselineId: null,
    });

    const { transitionChangeRequest } = await import("@/lib/change-requests");
    await expect(transitionChangeRequest("cr1", "p1", "u1", "APPLIED"))
      .rejects.toThrow("INVALID_TRANSITION");
  });

  it("transition to APPLIED captures baseline", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue({
      id: "cr1", projectId: "p1", status: "APPROVED", baselineId: null,
    });
    mockPrisma.changeRequest.update.mockResolvedValue({
      id: "cr1", projectId: "p1", reference: "CR-001", title: "CR",
      status: "APPLIED", baselineId: "baseline-1",
      submittedBy: null, decidedBy: null,
    });

    const { transitionChangeRequest } = await import("@/lib/change-requests");
    const { captureBaseline } = await import("@/lib/baselines");
    const cr = await transitionChangeRequest("cr1", "p1", "u1", "APPLIED");
    expect(cr.status).toBe("APPLIED");
    expect(captureBaseline).toHaveBeenCalled();
  });

  it("deleteChangeRequest only allows DRAFT status", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue({
      id: "cr1", projectId: "p1", status: "SUBMITTED",
    });

    const { deleteChangeRequest } = await import("@/lib/change-requests");
    await expect(deleteChangeRequest("cr1", "p1", "u1"))
      .rejects.toThrow("CR_NOT_DELETABLE");
  });

  it("deleteChangeRequest soft-deletes DRAFT", async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue({
      id: "cr1", projectId: "p1", status: "DRAFT",
    });
    mockPrisma.changeRequest.update.mockResolvedValue({});

    const { deleteChangeRequest } = await import("@/lib/change-requests");
    await deleteChangeRequest("cr1", "p1", "u1");
    expect(mockPrisma.changeRequest.update).toHaveBeenCalled();
  });
});

// ── Automation rule tests ──

describe("Automation rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createRule creates conditions and actions in transaction", async () => {
    mockPrisma.automationRule.create.mockResolvedValue({
      id: "ar1", teamId: "t1", name: "Auto status", trigger: "STATUS_CHANGED",
      enabled: true, createdBy: "u1", conditions: [], actions: [],
    });

    const { createRule } = await import("@/lib/automation");
    const rule = await createRule("t1", "u1", {
      name: "Auto status",
      trigger: "STATUS_CHANGED",
      conditions: [{ field: "status", op: "EQUALS", value: "done" }],
      actions: [{ type: "SET_PRIORITY", params: { value: "high" } }],
    });

    expect(rule.name).toBe("Auto status");
    expect(mockPrisma.automationRule.create).toHaveBeenCalled();
  });

  it("listRules filters by team and project", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([]);
    const { listRules } = await import("@/lib/automation");
    await listRules("p1", "t1");
    expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teamId: "t1", projectId: "p1" }),
      }),
    );
  });

  it("listRules handles null projectId (team-wide)", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([]);
    const { listRules } = await import("@/lib/automation");
    await listRules(null, "t1");
    expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: null }),
      }),
    );
  });

  it("deleteRule soft-deletes", async () => {
    mockPrisma.automationRule.findUnique.mockResolvedValue({ id: "ar1" });
    mockPrisma.automationRule.update.mockResolvedValue({});

    const { deleteRule } = await import("@/lib/automation");
    await deleteRule("ar1", "u1");
    expect(mockPrisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ar1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it("deleteRule throws if not found", async () => {
    mockPrisma.automationRule.findUnique.mockResolvedValue(null);
    const { deleteRule } = await import("@/lib/automation");
    await expect(deleteRule("x", "u1")).rejects.toThrow("RULE_NOT_FOUND");
  });

  it("evaluateAndRun skips already-fired rules (loop guard)", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([{
      id: "ar1", projectId: "p1", trigger: "STATUS_CHANGED", enabled: true,
      conditions: [{ id: "c1", ruleId: "ar1", field: "status", op: "EQUALS", value: "done" }],
      actions: [],
    }]);
    mockPrisma.automationTriggerEvent.findUnique.mockResolvedValue({ id: "te1" });

    const { evaluateAndRun } = await import("@/lib/automation");
    const results = await evaluateAndRun({
      id: "task1", status: "done", priority: "med", title: "T",
      projectId: "p1", dueDate: null, assigneeIds: [],
    }, "STATUS_CHANGED");

    expect(results).toHaveLength(0);
    expect(mockPrisma.automationTriggerEvent.create).not.toHaveBeenCalled();
  });

  it("evaluateAndRun fires matching rules", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([{
      id: "ar1", projectId: "p1", trigger: "STATUS_CHANGED", createdBy: "u1",
      enabled: true,
      conditions: [{ id: "c1", ruleId: "ar1", field: "status", op: "EQUALS", value: "done" }],
      actions: [{ id: "a1", ruleId: "ar1", type: "SET_PRIORITY", params: { value: "high" } }],
    }]);
    mockPrisma.automationTriggerEvent.findUnique.mockResolvedValue(null);
    mockPrisma.automationTriggerEvent.create.mockResolvedValue({});
    mockPrisma.automationRun.create.mockResolvedValue({});

    const { evaluateAndRun } = await import("@/lib/automation");
    const results = await evaluateAndRun({
      id: "task1", status: "done", priority: "med", title: "T",
      projectId: "p1", dueDate: null, assigneeIds: [],
    }, "STATUS_CHANGED");

    expect(results).toHaveLength(1);
    expect(results[0].actionsExecuted).toBe(1);
    expect(mockPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: "high" }),
      }),
    );
  });

  it("evaluateAndRun skips rules with unmet conditions", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([{
      id: "ar1", projectId: "p1", trigger: "STATUS_CHANGED", enabled: true,
      conditions: [{ id: "c1", ruleId: "ar1", field: "status", op: "EQUALS", value: "cancelled" }],
      actions: [],
    }]);
    mockPrisma.automationTriggerEvent.findUnique.mockResolvedValue(null);

    const { evaluateAndRun } = await import("@/lib/automation");
    const results = await evaluateAndRun({
      id: "task1", status: "done", priority: "med", title: "T",
      projectId: "p1", dueDate: null, assigneeIds: [],
    }, "STATUS_CHANGED");

    expect(results).toHaveLength(0);
  });

  it("evaluateAndRun respects max depth", async () => {
    const { evaluateAndRun } = await import("@/lib/automation");
    const results = await evaluateAndRun({
      id: "task1", status: "done", priority: "med", title: "T",
      projectId: "p1", dueDate: null, assigneeIds: [],
    }, "STATUS_CHANGED", 5);

    expect(results).toHaveLength(0);
    expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
  });
});
