import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canAccessDepartment } from "@/lib/rbac";
import { getTimesheetReport } from "@/lib/timesheets/report";
import { problemResponse } from "@/lib/api/problem";

const querySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  format: z.enum(["json", "csv"]).default("json"),
}).strict();

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  if (!(await can(authResult.userId, "timesheet.approve", authResult.organizationId)) || !(await canAccessDepartment(authResult.userId, resolvedParams.id, authResult.organizationId))) {
    return problemResponse(request, 403, "FORBIDDEN", "Insufficient timesheet permissions");
  }

  const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return problemResponse(request, 400, "VALIDATION_ERROR", "Invalid report parameters");
  }
  if (parsed.data.from && parsed.data.to && new Date(parsed.data.from) >= new Date(parsed.data.to)) {
    return problemResponse(request, 400, "VALIDATION_ERROR", "from must be before to");
  }

  const rows = await getTimesheetReport({
    organizationId: authResult.organizationId,
    departmentId: resolvedParams.id,
    ...(parsed.data.from ? { periodStart: new Date(parsed.data.from) } : {}),
    ...(parsed.data.to ? { periodEnd: new Date(parsed.data.to) } : {}),
  });

  if (parsed.data.format === "csv") {
    const header = "project,user,currency,minutes,cost_minor,bill_minor";
    const body = [
      header,
      ...rows.map((row) => [
        row.projectName,
        row.userName,
        row.currency,
        row.minutes,
        row.costMinor,
        row.billMinor,
      ].map(csvCell).join(",")),
    ].join("\n");
    return new Response(`${body}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="timesheet-report-${resolvedParams.id}.csv"`,
      },
    });
  }

  return NextResponse.json({ data: rows });
}
