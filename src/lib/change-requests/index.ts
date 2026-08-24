import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { captureBaseline } from "@/lib/baselines";
import type { ChangeRequestStatus } from "@prisma/client";

// ── Types ──

export type ChangeRequestData = {
  id: string;
  projectId: string;
  reference: string;
  title: string;
  description: string | null;
  status: ChangeRequestStatus;
  scheduleDeltaDays: number | null;
  costImpactMinor: number | null;
  costCurrency: string | null;
  submittedById: string | null;
  submittedAt: Date | null;
  decidedById: string | null;
  decidedAt: Date | null;
  baselineId: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedBy?: { id: string; displayName: string } | null;
  decidedBy?: { id: string; displayName: string } | null;
};

// ── Next reference ──

async function nextCrReference(projectId: string): Promise<string> {
  const last = await prisma.changeRequest.findFirst({
    where: { projectId },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  if (!last) return "CR-001";
  const num = parseInt(last.reference.replace("CR-", ""), 10);
  return `CR-${String(num + 1).padStart(3, "0")}`;
}

// ── Create ──

export async function createChangeRequest(
  projectId: string,
  teamId: string,
  userId: string,
  data: {
    title: string;
    description?: string | undefined;
    scheduleDeltaDays?: number | undefined;
    costImpactMinor?: number | undefined;
    costCurrency?: string | undefined;
  },
): Promise<ChangeRequestData> {
  const reference = await nextCrReference(projectId);

  const cr = await prisma.changeRequest.create({
    data: {
      projectId,
      teamId,
      reference,
      title: data.title,
      description: data.description ?? null,
      scheduleDeltaDays: data.scheduleDeltaDays ?? null,
      costImpactMinor: data.costImpactMinor ?? null,
      costCurrency: data.costCurrency ?? null,
    },
    include: {
      submittedBy: { select: { id: true, displayName: true } },
      decidedBy: { select: { id: true, displayName: true } },
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "change_request_created",
    entityType: "change_request",
    entityId: cr.id,
    after: { projectId, reference, title: data.title },
  });

  return cr as ChangeRequestData;
}

// ── Status transitions ──

const VALID_TRANSITIONS: Record<ChangeRequestStatus, ChangeRequestStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: ["APPLIED"],
  REJECTED: [],
  APPLIED: [],
};

export async function transitionChangeRequest(
  crId: string,
  projectId: string,
  userId: string,
  targetStatus: ChangeRequestStatus,
): Promise<ChangeRequestData> {
  const cr = await prisma.changeRequest.findUnique({ where: { id: crId } });
  if (!cr || cr.projectId !== projectId) {
    throw new Error("CR_NOT_FOUND");
  }

  const allowed = VALID_TRANSITIONS[cr.status];
  if (!allowed.includes(targetStatus)) {
    throw new Error("INVALID_TRANSITION");
  }

  // Apply: snapshot a baseline linked to the CR
  let baselineId = cr.baselineId;
  if (targetStatus === "APPLIED") {
    const baseline = await captureBaseline(
      projectId,
      `CR ${cr.reference}: ${cr.title}`,
      userId,
      "CHANGE_REQUEST",
    );
    baselineId = baseline.id;
  }

  const updateData: Record<string, unknown> = {
    status: targetStatus,
    ...(baselineId && { baselineId }),
    ...(targetStatus === "SUBMITTED" && { submittedById: userId, submittedAt: new Date() }),
    ...(targetStatus === "APPROVED" || targetStatus === "REJECTED"
      ? { decidedById: userId, decidedAt: new Date() }
      : {}),
  };

  const updated = await prisma.changeRequest.update({
    where: { id: crId },
    data: updateData,
    include: {
      submittedBy: { select: { id: true, displayName: true } },
      decidedBy: { select: { id: true, displayName: true } },
    },
  });

  await logAudit({
    actorUserId: userId,
    action: targetStatus === "APPLIED" ? "change_request_applied" : "change_request_updated",
    entityType: "change_request",
    entityId: crId,
    before: { status: cr.status },
    after: { status: targetStatus, baselineId },
  });

  return updated as ChangeRequestData;
}

// ── List ──

export async function listChangeRequests(
  projectId: string,
  opts?: { status?: ChangeRequestStatus },
): Promise<ChangeRequestData[]> {
  const where = {
    projectId,
    deletedAt: null,
    ...(opts?.status && { status: opts.status }),
  };

  const crs = await prisma.changeRequest.findMany({
    where,
    include: {
      submittedBy: { select: { id: true, displayName: true } },
      decidedBy: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return crs as ChangeRequestData[];
}

// ── Delete (soft) ──

export async function deleteChangeRequest(crId: string, projectId: string, userId: string): Promise<void> {
  const existing = await prisma.changeRequest.findUnique({ where: { id: crId } });
  if (!existing || existing.projectId !== projectId) {
    throw new Error("CR_NOT_FOUND");
  }

  if (existing.status !== "DRAFT") {
    throw new Error("CR_NOT_DELETABLE");
  }

  await prisma.changeRequest.update({
    where: { id: crId },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: userId,
    action: "change_request_deleted",
    entityType: "change_request",
    entityId: crId,
  });
}
