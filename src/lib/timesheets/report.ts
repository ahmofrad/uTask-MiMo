import { prisma } from "@/lib/db";

export type TimesheetReportRow = {
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  currency: string;
  minutes: number;
  costMinor: number;
  billMinor: number;
};

export async function getTimesheetReport(input: {
  organizationId?: string;
  departmentId?: string;
  periodStart?: Date;
  periodEnd?: Date;
}) : Promise<TimesheetReportRow[]> {
  const entries = await prisma.timeEntry.findMany({
    where: {
      ...(input.departmentId || input.periodStart || input.periodEnd
        ? {
            period: {
              ...(input.departmentId ? { departmentId: input.departmentId } : {}),
              ...(input.organizationId ? { department: { organizationId: input.organizationId } } : {}),
              ...(input.periodStart ? { periodStart: { gte: input.periodStart } } : {}),
              ...(input.periodEnd ? { periodEnd: { lt: input.periodEnd } } : {}),
            },
          }
        : {}),
    },
    select: {
      projectId: true,
      project: { select: { name: true } },
      userId: true,
      user: { select: { displayName: true } },
      minutes: true,
      costRateMinorSnapshot: true,
      billRateMinorSnapshot: true,
      currencySnapshot: true,
    },
  });

  const grouped = new Map<string, TimesheetReportRow>();
  for (const entry of entries) {
    const key = `${entry.projectId}:${entry.userId}:${entry.currencySnapshot}`;
    const current = grouped.get(key) ?? {
      projectId: entry.projectId,
      projectName: entry.project.name,
      userId: entry.userId,
      userName: entry.user.displayName,
      currency: entry.currencySnapshot,
      minutes: 0,
      costMinor: 0,
      billMinor: 0,
    };
    current.minutes += entry.minutes;
    current.costMinor += Math.round((entry.minutes / 60) * entry.costRateMinorSnapshot);
    current.billMinor += Math.round((entry.minutes / 60) * (entry.billRateMinorSnapshot ?? 0));
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName) || a.userName.localeCompare(b.userName) || a.currency.localeCompare(b.currency),
  );
}
