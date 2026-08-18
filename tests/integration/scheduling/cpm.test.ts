import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { bumpScheduleVersion, computeSchedule } from "@/lib/scheduling/cpm";
import { addDependency, DependencyError } from "@/lib/tasks/dependencies";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let ownerId = "";

async function mkTask(title: string, extra: Record<string, unknown> = {}) {
  const { parentTaskId, assigneeId, ...rest } = extra;
  const data: Record<string, unknown> = {
    project: { connect: { id: projectId } },
    createdBy: { connect: { id: ownerId } },
    title,
    status: "open",
    ...rest,
  };
  if (parentTaskId !== undefined) data.parentTask = { connect: { id: String(parentTaskId) } };
  if (assigneeId !== undefined) data.assignee = { connect: { id: String(assigneeId) } };
  const t = await prisma.task.create({ data: data as never });
  return t.id;
}

function day(n: number): Date {
  const d = new Date("2026-01-01T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

maybe("cpm scheduling engine (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available");
    ownerId = owner.id;
    const p = await prisma.project.create({
      data: { name: `cpm-it-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    if (!projectId) return;
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  it("schedules a FS chain with zero float (critical)", async () => {
    const a = await mkTask("A", { startDate: day(0).toISOString(), dueDate: day(0).toISOString() });
    const b = await mkTask("B", { startDate: day(1).toISOString(), dueDate: day(1).toISOString() });
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

    const result = await computeSchedule(projectId);
    expect(result.schedule[a].critical).toBe(true);
    expect(result.schedule[b].critical).toBe(true);
    expect(result.schedule[a].ef).toBeLessThanOrEqual(result.schedule[b].es);
    expect(result.criticalChain).toContain(a);
    expect(result.criticalChain).toContain(b);
  });

  it("flags a shorter parallel path as non-critical", async () => {
    const start = await mkTask("Start", { startDate: day(0).toISOString(), dueDate: day(0).toISOString() });
    const longP = await mkTask("Long", { startDate: day(1).toISOString(), dueDate: day(5).toISOString() });
    const shortP = await mkTask("Short", { startDate: day(1).toISOString(), dueDate: day(2).toISOString() });
    const end = await mkTask("End", { startDate: day(6).toISOString(), dueDate: day(6).toISOString() });
    await addDependency({ taskId: longP, dependsOnId: start, type: "FINISH_TO_START", createdBy: ownerId });
    await addDependency({ taskId: shortP, dependsOnId: start, type: "FINISH_TO_START", createdBy: ownerId });
    await addDependency({ taskId: end, dependsOnId: longP, type: "FINISH_TO_START", createdBy: ownerId });
    await addDependency({ taskId: end, dependsOnId: shortP, type: "FINISH_TO_START", createdBy: ownerId });

    const result = await computeSchedule(projectId);
    expect(result.schedule[longP].critical).toBe(true);
    expect(result.schedule[shortP].critical).toBe(false);
    expect(result.schedule[shortP].float).toBeGreaterThan(0);
  });

  it("treats milestones as zero-duration", async () => {
    const a = await mkTask("M-A", { startDate: day(0).toISOString(), dueDate: day(0).toISOString() });
    const m = await mkTask("M-Mile", { startDate: day(1).toISOString() });
    await prisma.task.update({ where: { id: m }, data: { isMilestone: true } });
    await addDependency({ taskId: m, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

    const result = await computeSchedule(projectId);
    expect(result.schedule[m].es).toBe(result.schedule[m].ef);
  });

  it("schedules a finish-only task back from its deadline and flags it critical", async () => {
    const a = await mkTask("D-A", { dueDate: day(3).toISOString(), estimatedHours: 8 });
    const b = await mkTask("D-B", { dueDate: day(10).toISOString(), estimatedHours: 80 });
    await bumpScheduleVersion(projectId); // created directly, bypassing mutations

    const result = await computeSchedule(projectId);
    // a is finish-only: it lands exactly on its due date and the deadline
    // binds, so it has zero float — critical even though b drives the
    // project end.
    expect(result.schedule[a].critical).toBe(true);
    expect(result.schedule[a].float).toBeLessThanOrEqual(0);
    expect(result.schedule[a].ef).toBe(new Date(day(3)).getTime());
    expect(result.schedule[b].critical).toBe(true);
  });

  it("never flags a completed task as critical", async () => {
    const a = await mkTask("Done-A", { dueDate: day(3).toISOString(), estimatedHours: 8 });
    await prisma.task.update({ where: { id: a }, data: { status: "done" } });
    const b = await mkTask("Done-B", { dueDate: day(10).toISOString(), estimatedHours: 80 });
    await bumpScheduleVersion(projectId);

    const result = await computeSchedule(projectId);
    expect(result.schedule[a].critical).toBe(false);
    expect(result.schedule[a].float).toBeLessThanOrEqual(0);
  });

  it("excludes undated tasks from the schedule", async () => {
    const a = await mkTask("U-A", { startDate: day(0).toISOString(), dueDate: day(0).toISOString() });
    const undated = await mkTask("U-Undated");
    await addDependency({ taskId: undated, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

    const result = await computeSchedule(projectId);
    expect(result.schedule[a]).toBeDefined();
    expect(result.schedule[undated]?.unscheduled).toBe(true);
  });

  it("throws DEPENDENCY_CYCLE on a cyclic graph", async () => {
    const a = await mkTask("C-A", { startDate: day(0).toISOString(), dueDate: day(0).toISOString() });
    const b = await mkTask("C-B", { startDate: day(1).toISOString(), dueDate: day(1).toISOString() });
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });
    // Inject a cycle directly (addDependency would reject it).
    await prisma.taskDependency.create({
      data: { taskId: a, dependsOnId: b, type: "FINISH_TO_START", lag: 0, lagUnit: "DAY", createdBy: ownerId },
    });
    await expect(computeSchedule(projectId)).rejects.toMatchObject({ code: "DEPENDENCY_CYCLE" });
  });
});
