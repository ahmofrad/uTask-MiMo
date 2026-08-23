import { prisma } from "@/lib/db";
import { resolveCostRate } from "@/lib/timesheets/rate-cards";
import type { TimesheetStatus } from "@prisma/client";

export type TimesheetTransition = "submit" | "approve" | "reject" | "reopen";

/**
 * The approval state machine. Returns the next status, or null when the
 * transition is not allowed from the current status.
 *
 *   open ──submit──▶ submitted ──approve──▶ approved ──reopen──▶ reopened
 *                     ▲  │                    │
 *   rejected ◀─reject──┘  └── submit ◀────────┘
 */
export function transitionStatus(
  current: TimesheetStatus,
  transition: TimesheetTransition,
): TimesheetStatus | null {
  switch (transition) {
    case "submit":
      return current === "open" || current === "rejected" || current === "reopened" ? "submitted" : null;
    case "approve":
      return current === "submitted" ? "approved" : null;
    case "reject":
      return current === "submitted" ? "rejected" : null;
    case "reopen":
      return current === "approved" ? "reopened" : null;
  }
}

/** Which statuses accept new time entries (still editable by the owner). */
const EDITABLE_STATUSES: TimesheetStatus[] = ["open", "rejected", "reopened"];

export async function createPeriod(input: {
  departmentId: string;
  ownerId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return prisma.timesheetPeriod.create({
    data: {
      departmentId: input.departmentId,
      ownerId: input.ownerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "open",
    },
  });
}

export async function listPeriods(input: {
  departmentId: string;
  ownerId?: string;
}) {
  return prisma.timesheetPeriod.findMany({
    where: {
      departmentId: input.departmentId,
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    },
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
      entries: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { periodStart: "desc" },
  });
}

export async function getPeriod(id: string) {
  return prisma.timesheetPeriod.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
      entries: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** Log a time entry against a period, snapshoting the cost rate at log time. */
export async function addEntry(input: {
  periodId: string;
  userId: string;
  projectId: string;
  taskId?: string | null;
  minutes: number;
  billable: boolean;
  organizationId?: string;
}) {
  const period = await prisma.timesheetPeriod.findUnique({
    where: { id: input.periodId },
    select: { status: true },
  });
  if (!period) {
    const err = new Error("Timesheet period not found") as Error & { code?: string };
    err.code = "PERIOD_NOT_FOUND";
    throw err;
  }
  if (!EDITABLE_STATUSES.includes(period.status)) {
    const err = new Error("Timesheet period is not editable") as Error & { code?: string };
    err.code = "PERIOD_NOT_EDITABLE";
    throw err;
  }

  const rate = await resolveCostRate(input.userId, new Date(), input.organizationId);

  return prisma.timeEntry.create({
    data: {
      periodId: input.periodId,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      userId: input.userId,
      minutes: input.minutes,
      billable: input.billable,
      costRateMinorSnapshot: rate.costRateMinor,
      billRateMinorSnapshot: rate.billRateMinor,
      currencySnapshot: rate.currency,
    },
  });
}

/** Apply a state transition and return the updated period (or throw). */
export async function transitionPeriod(
  id: string,
  transition: TimesheetTransition,
): Promise<{ before: TimesheetStatus; after: TimesheetStatus }> {
  const period = await prisma.timesheetPeriod.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!period) {
    const err = new Error("Timesheet period not found") as Error & { code?: string };
    err.code = "PERIOD_NOT_FOUND";
    throw err;
  }

  const next = transitionStatus(period.status, transition);
  if (!next) {
    const err = new Error(`Cannot ${transition} a ${period.status} timesheet`) as Error & { code?: string };
    err.code = "INVALID_TRANSITION";
    throw err;
  }

  const updated = await prisma.timesheetPeriod.updateMany({
    where: { id, status: period.status },
    data: { status: next },
  });
  if (updated.count !== 1) {
    const err = new Error("Timesheet period changed before this transition completed") as Error & { code?: string };
    err.code = "CONCURRENT_TRANSITION";
    throw err;
  }

  return { before: period.status, after: next };
}
