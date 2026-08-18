import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { buildGanttReport } from "@/lib/gantt/report";
import { bumpScheduleVersion } from "@/lib/scheduling/cpm";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let ownerId = "";

async function mkTask(title: string, extra: Record<string, unknown> = {}) {
  const { parentTaskId, ...rest } = extra;
  const data: Record<string, unknown> = {
    project: { connect: { id: projectId } },
    createdBy: { connect: { id: ownerId } },
    title,
    status: "open",
    ...rest,
  };
  if (parentTaskId !== undefined) data.parentTask = { connect: { id: String(parentTaskId) } };
  const t = await prisma.task.create({ data: data as never });
  return t.id;
}

function day(n: number): Date {
  const d = new Date("2026-01-01T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

maybe("gantt report critical floats (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available");
    ownerId = owner.id;
    const p = await prisma.project.create({
      data: { name: `gantt-report-it-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    if (!projectId) return;
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  it("exposes zero float on deadline-bound critical leaves", async () => {
    const a = await mkTask("R-A", { dueDate: day(3).toISOString(), estimatedHours: 8 });
    const b = await mkTask("R-B", { dueDate: day(10).toISOString(), estimatedHours: 80 });
    await bumpScheduleVersion(projectId); // created directly, bypassing mutations

    const report = await buildGanttReport(projectId, true);
    const rowA = report.tasks.find((t) => t.id === a);
    const rowB = report.tasks.find((t) => t.id === b);

    expect(rowA?.critical).toBe(true);
    expect(rowA?.floatDays).toBe(0);
    expect(rowB?.critical).toBe(true);
    expect(rowB?.floatDays).toBe(0);
    expect(report.criticalChain).toContain(a);
  });

  it("rolls criticality and float up to summary rows", async () => {
    const summary = await mkTask("R-Summary");
    await mkTask("R-Leaf", { parentTaskId: summary, dueDate: day(5).toISOString(), estimatedHours: 8 });
    await bumpScheduleVersion(projectId); // created directly, bypassing mutations

    const report = await buildGanttReport(projectId, true);
    const rowSummary = report.tasks.find((t) => t.id === summary);
    const leaf = report.tasks.find((t) => t.title === "R-Leaf");

    expect(leaf?.critical).toBe(true);
    expect(rowSummary?.isSummary).toBe(true);
    expect(rowSummary?.critical).toBe(true);
    expect(rowSummary?.floatDays).toBe(0);
  });

  it("omits critical and float when criticality is not requested", async () => {
    const a = await mkTask("R-C", { dueDate: day(3).toISOString(), estimatedHours: 8 });
    await bumpScheduleVersion(projectId); // created directly, bypassing mutations

    const report = await buildGanttReport(projectId, false);
    const row = report.tasks.find((t) => t.id === a);

    expect(row?.critical).toBeUndefined();
    expect(row?.floatDays).toBeUndefined();
  });
});
