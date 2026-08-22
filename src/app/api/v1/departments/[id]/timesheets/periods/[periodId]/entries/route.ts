import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { addEntry, getPeriod } from "@/lib/timesheets";
import { timeEntryCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; periodId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const period = await getPeriod(resolvedParams.periodId);
  if (!period || period.departmentId !== resolvedParams.id) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Timesheet period not found" } },
      { status: 404 },
    );
  }
  // Logging time is the owner's own action; no permission required.
  if (period.ownerId !== userId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the owner may log time against this timesheet" } },
      { status: 403 },
    );
  }

  const parsed = timeEntryCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  let entry;
  try {
    entry = await addEntry({
      periodId: resolvedParams.periodId,
      userId,
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId ?? null,
      minutes: parsed.data.minutes,
      billable: parsed.data.billable,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "PERIOD_NOT_EDITABLE") {
      return NextResponse.json(
        { error: { code: "PERIOD_NOT_EDITABLE", message: (error as Error).message } },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    actorUserId: userId,
    action: "timesheet_entry_created",
    entityType: "time_entry",
    entityId: entry.id,
    after: { projectId: entry.projectId, minutes: entry.minutes, billable: entry.billable },
  });

  return NextResponse.json({ data: entry }, { status: 201 });
}
