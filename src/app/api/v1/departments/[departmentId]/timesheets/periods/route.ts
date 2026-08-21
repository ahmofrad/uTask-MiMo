import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac/can";
import { logAudit } from "@/lib/audit/log";
import { createPeriod, listPeriods } from "@/lib/timesheets";
import { timesheetPeriodCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ departmentId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Approvers see every period in the department; others see only their own.
  const isApprover = await can(userId, "timesheet.approve");
  const periods = await listPeriods({
    departmentId: resolvedParams.departmentId,
    ...(isApprover ? {} : { ownerId: userId }),
  });

  return NextResponse.json({ data: periods });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = timesheetPeriodCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const period = await createPeriod({
    departmentId: resolvedParams.departmentId,
    ownerId: userId,
    periodStart: new Date(parsed.data.periodStart),
    periodEnd: new Date(parsed.data.periodEnd),
  });

  await logAudit({
    actorUserId: userId,
    action: "timesheet_period_created",
    entityType: "timesheet_period",
    entityId: period.id,
    after: { departmentId: period.departmentId, periodStart: period.periodStart, periodEnd: period.periodEnd },
  });

  return NextResponse.json({ data: period }, { status: 201 });
}
