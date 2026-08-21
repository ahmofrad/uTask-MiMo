import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/can";
import { logAudit } from "@/lib/audit/log";
import { getPeriod, transitionPeriod, type TimesheetTransition } from "@/lib/timesheets";

type TransitionMode = "owner" | "approver";

const AUDIT_ACTION: Record<TimesheetTransition, string> = {
  submit: "timesheet_period_submitted",
  approve: "timesheet_period_approved",
  reject: "timesheet_period_rejected",
  reopen: "timesheet_period_reopened",
};

/**
 * Shared handler for submit/approve/reject/reopen.
 * - `owner` mode: only the period's owner may act.
 * - `approver` mode: requires the `timesheet.approve` permission.
 */
export async function handleTransition(
  transition: TimesheetTransition,
  mode: TransitionMode,
  userId: string,
  departmentId: string,
  periodId: string,
): Promise<NextResponse> {
  if (mode === "approver" && !(await can(userId, "timesheet.approve"))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const period = await getPeriod(periodId);
  if (!period || period.departmentId !== departmentId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Timesheet period not found" } },
      { status: 404 },
    );
  }

  if (mode === "owner" && period.ownerId !== userId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the owner may act on this timesheet" } },
      { status: 403 },
    );
  }

  let result;
  try {
    result = await transitionPeriod(periodId, transition);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "INVALID_TRANSITION") {
      return NextResponse.json(
        { error: { code: "INVALID_TRANSITION", message: (error as Error).message } },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    actorUserId: userId,
    action: AUDIT_ACTION[transition] as never,
    entityType: "timesheet_period",
    entityId: periodId,
    before: { status: result.before },
    after: { status: result.after },
  });

  return NextResponse.json({ data: { id: periodId, status: result.after } });
}
