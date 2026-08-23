import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { can, canAccessDepartment } from "@/lib/rbac/can";
import { getUserReadableProjectIds } from "@/lib/projects";
import { getTranslations } from "next-intl/server";
import { TimesheetView } from "@/components/timesheet/timesheet-view";

export default async function DepartmentTimesheetsPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("timesheets");

  const department = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!department || !(await canAccessDepartment(session.user.id, departmentId))) notFound();

  const isApprover = await can(session.user.id, "timesheet.approve");
  const readableProjectIds = await getUserReadableProjectIds(session.user.id);

  const entryInclude = {
    orderBy: { createdAt: "desc" as const },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  } as const;
  const scopedEntryInclude = {
    where: { projectId: { in: readableProjectIds ?? [] } },
    ...entryInclude,
  } as const;

  const periods = await prisma.timesheetPeriod.findMany({
    where: {
      departmentId,
      ...(isApprover ? {} : { ownerId: session.user.id }),
      ...(readableProjectIds === null ? {} : {
        entries: { some: { projectId: { in: readableProjectIds } } },
      }),
    },
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
      entries: readableProjectIds === null ? entryInclude : scopedEntryInclude,
    },
    orderBy: { periodStart: "desc" },
  });

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      ...(readableProjectIds !== null ? { id: { in: readableProjectIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg-primary">
          {t("title")} — {department.name}
        </h1>
        <p className="text-fg-muted mt-1">{t("subtitle")}</p>
      </div>
      <TimesheetView
        departmentId={departmentId}
        periods={periods.map((p) => ({
          id: p.id,
          status: p.status,
          periodStart: p.periodStart.toISOString(),
          periodEnd: p.periodEnd.toISOString(),
          owner: p.owner,
          entries: p.entries.map((e) => ({
            id: e.id,
            minutes: e.minutes,
            billable: e.billable,
            costRateMinorSnapshot: e.costRateMinorSnapshot,
            billRateMinorSnapshot: e.billRateMinorSnapshot,
            currencySnapshot: e.currencySnapshot,
            createdAt: e.createdAt.toISOString(),
            project: e.project,
            task: e.task,
          })),
        }))}
        projects={projects}
        isApprover={isApprover}
        currentUserId={session.user.id}
      />
    </div>
  );
}
