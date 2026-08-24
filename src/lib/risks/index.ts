import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import type { RiskResponse, RiskStatus } from "@prisma/client";

// ── Types ──

export type RiskData = {
  id: string;
  projectId: string;
  reference: string;
  title: string;
  description: string | null;
  probability: number;
  impact: number;
  score: number;
  response: RiskResponse;
  mitigationPlan: string | null;
  ownerId: string | null;
  status: RiskStatus;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  owner?: { id: string; displayName: string; email: string } | null;
};

// ── Next reference ──

async function nextRiskReference(projectId: string): Promise<string> {
  const last = await prisma.riskRecord.findFirst({
    where: { projectId },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  if (!last) return "RISK-001";
  const num = parseInt(last.reference.replace("RISK-", ""), 10);
  return `RISK-${String(num + 1).padStart(3, "0")}`;
}

// ── Create ──

export async function createRisk(
  projectId: string,
  teamId: string,
  userId: string,
  data: {
    title: string;
    description?: string | undefined;
    probability?: number | undefined;
    impact?: number | undefined;
    response?: RiskResponse | undefined;
    mitigationPlan?: string | undefined;
    ownerId?: string | undefined;
  },
): Promise<RiskData> {
  const probability = data.probability ?? 1;
  const impact = data.impact ?? 1;
  const reference = await nextRiskReference(projectId);

  const risk = await prisma.riskRecord.create({
    data: {
      projectId,
      teamId,
      reference,
      title: data.title,
      description: data.description ?? null,
      probability,
      impact,
      score: probability * impact,
      response: data.response ?? "MITIGATE",
      mitigationPlan: data.mitigationPlan ?? null,
      ownerId: data.ownerId ?? null,
    },
    include: { owner: { select: { id: true, displayName: true, email: true } } },
  });

  await logAudit({
    actorUserId: userId,
    action: "risk_created",
    entityType: "risk",
    entityId: risk.id,
    after: { projectId, reference, title: data.title, probability, impact, score: probability * impact },
  });

  return risk as unknown as RiskData;
}

// ── Update ──

export async function updateRisk(
  riskId: string,
  projectId: string,
  userId: string,
  data: {
    title?: string | undefined;
    description?: string | undefined;
    probability?: number | undefined;
    impact?: number | undefined;
    response?: RiskResponse | undefined;
    mitigationPlan?: string | undefined;
    ownerId?: string | undefined;
    status?: RiskStatus | undefined;
  },
): Promise<RiskData> {
  const existing = await prisma.riskRecord.findUnique({ where: { id: riskId } });
  if (!existing || existing.projectId !== projectId) {
    throw new Error("RISK_NOT_FOUND");
  }

  const probability = data.probability ?? existing.probability;
  const impact = data.impact ?? existing.impact;
  const status = data.status ?? existing.status;
  const closedAt = status === "CLOSED" && existing.status !== "CLOSED" ? new Date() : existing.closedAt;

  const risk = await prisma.riskRecord.update({
    where: { id: riskId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.probability !== undefined && { probability: data.probability }),
      ...(data.impact !== undefined && { impact: data.impact }),
      score: probability * impact,
      ...(data.response !== undefined && { response: data.response }),
      ...(data.mitigationPlan !== undefined && { mitigationPlan: data.mitigationPlan }),
      ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
      status,
      closedAt,
    },
    include: { owner: { select: { id: true, displayName: true, email: true } } },
  });

  await logAudit({
    actorUserId: userId,
    action: "risk_updated",
    entityType: "risk",
    entityId: riskId,
    before: { probability: existing.probability, impact: existing.impact, status: existing.status },
    after: { probability, impact, status, score: probability * impact },
  });

  return risk as unknown as RiskData;
}

// ── List ──

export async function listRisks(
  projectId: string,
  opts?: { status?: RiskStatus; minScore?: number },
): Promise<RiskData[]> {
  const where = {
    projectId,
    deletedAt: null,
    ...(opts?.status && { status: opts.status }),
    ...(opts?.minScore !== undefined && { score: { gte: opts.minScore } }),
  };

  const risks = await prisma.riskRecord.findMany({
    where,
    include: { owner: { select: { id: true, displayName: true, email: true } } },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });

  return risks as unknown as RiskData[];
}

// ── Delete (soft) ──

export async function deleteRisk(riskId: string, projectId: string, userId: string): Promise<void> {
  const existing = await prisma.riskRecord.findUnique({ where: { id: riskId } });
  if (!existing || existing.projectId !== projectId) {
    throw new Error("RISK_NOT_FOUND");
  }

  await prisma.riskRecord.update({
    where: { id: riskId },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: userId,
    action: "risk_deleted",
    entityType: "risk",
    entityId: riskId,
  });
}
