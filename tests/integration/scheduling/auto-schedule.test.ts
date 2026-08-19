import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { updateTask } from "@/lib/tasks/mutations";
import { addDependency } from "@/lib/tasks/dependencies";
import { setInstanceSetting } from "@/lib/settings/instance";
import { WORKING_DAYS_SETTING_KEY } from "@/lib/date/working-day";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let ownerId = "";

async function mkTask(title: string, start: string | null, due: string | null): Promise<string> {
  const t = await prisma.task.create({
    data: {
      project: { connect: { id: projectId } },
      createdBy: { connect: { id: ownerId } },
      title,
      status: "open",
      startDate: start ? new Date(start) : null,
      dueDate: due ? new Date(due) : null,
    } as never,
  });
  return t.id;
}

function day(n: number): string {
  const d = new Date("2026-01-01T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
}

maybe("auto-schedule dependents (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available");
    ownerId = owner.id;
    const p = await prisma.project.create({
      data: { name: `auto-sched-it-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    projectId = p.id;
    // These tests assume the default calendar (every day is a working day);
    // remove any config left behind by other suites.
    await prisma.instanceSetting.deleteMany({ where: { key: WORKING_DAYS_SETTING_KEY } });
  });

  afterAll(async () => {
    await prisma.instanceSetting.deleteMany({ where: { key: WORKING_DAYS_SETTING_KEY } });
    if (!projectId) return;
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  it("pushes a dependent chain forward when the predecessor moves later", async () => {
    const a = await mkTask("A", day(0), day(0));
    const b = await mkTask("B", day(1), day(1));
    const c = await mkTask("C", day(2), day(2));
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });
    await addDependency({ taskId: c, dependsOnId: b, type: "FINISH_TO_START", createdBy: ownerId });

    const { autoScheduled } = await updateTask(a, { startDate: day(5), dueDate: day(5) }, ownerId);

    expect(autoScheduled.map((change) => change.id).sort()).toEqual([b, c].sort());
    // Every entry carries the task's pre-change dates so clients can undo.
    const byId = new Map(autoScheduled.map((change) => [change.id, change]));
    expect(byId.get(b)?.startDate?.toISOString()).toBe(day(1));
    expect(byId.get(c)?.startDate?.toISOString()).toBe(day(2));

    const bRow = await prisma.task.findUniqueOrThrow({ where: { id: b }, select: { startDate: true, dueDate: true } });
    const cRow = await prisma.task.findUniqueOrThrow({ where: { id: c }, select: { startDate: true, dueDate: true } });
    // B starts the day after A finishes (FS, 0 lag); C follows B.
    expect(bRow.startDate?.toISOString()).toBe(day(6));
    expect(bRow.dueDate?.toISOString()).toBe(day(6));
    expect(cRow.startDate?.toISOString()).toBe(day(7));
    expect(cRow.dueDate?.toISOString()).toBe(day(7));
  });

  it("never moves dependents earlier when the predecessor moves back", async () => {
    const a = await mkTask("A2", day(10), day(10));
    const b = await mkTask("B2", day(12), day(12));
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

    const { autoScheduled } = await updateTask(a, { startDate: day(8), dueDate: day(8) }, ownerId);
    expect(autoScheduled).toEqual([]);

    const bRow = await prisma.task.findUniqueOrThrow({ where: { id: b }, select: { startDate: true } });
    expect(bRow.startDate?.toISOString()).toBe(day(12));
  });

  it("preserves duration when a dependent is pushed forward", async () => {
    // A spans day 0–4 (5 days). B starts day 6, so it is initially valid
    // (A finishes day 5). Moving A to day 2–6 makes it finish day 7, which
    // pushes B to start day 7 while keeping its 3-day duration.
    const a = await mkTask("A3", day(0), day(4));
    const b = await mkTask("B3", day(6), day(9));
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

    const move = await updateTask(a, { startDate: day(2), dueDate: day(6) }, ownerId);
    expect(move.autoScheduled.map((change) => change.id)).toEqual([b]);
    expect(move.autoScheduled[0]?.startDate?.toISOString()).toBe(day(6));
    expect(move.autoScheduled[0]?.dueDate?.toISOString()).toBe(day(9));

    const bRow = await prisma.task.findUniqueOrThrow({ where: { id: b }, select: { startDate: true, dueDate: true } });
    expect(bRow.startDate?.toISOString()).toBe(day(7));
    expect(bRow.dueDate?.toISOString()).toBe(day(10));
  });

  it("audits every auto-scheduled change", async () => {
    const a = await mkTask("A4", day(0), day(0));
    const b = await mkTask("B4", day(1), day(1));
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

    await updateTask(a, { startDate: day(3), dueDate: day(3) }, ownerId);

    const rows = await prisma.auditLog.findMany({
      where: { entityId: b, action: "task_updated" },
      orderBy: { occurredAt: "desc" },
      take: 1,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.actorUserId).toBe(ownerId);
  });

  it("skips weekends when pushing a dependent forward", async () => {
    // day(4) = Mon Jan 5, day(5) = Tue Jan 6, day(8) = Fri Jan 9,
    // day(9) = Sat Jan 10, day(11) = Mon Jan 12. Weekend = Sat + Sun.
    await setInstanceSetting(WORKING_DAYS_SETTING_KEY, { weekendDays: [6, 0], holidays: [] });
    try {
      const a = await mkTask("A5", day(4), day(4));
      const b = await mkTask("B5", day(5), day(5));
      await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

      // A moves to Fri Jan 9 and finishes Sat Jan 10 — B must land on the
      // next working day (Mon Jan 12), not Saturday.
      const move = await updateTask(a, { startDate: day(8), dueDate: day(8) }, ownerId);
      expect(move.autoScheduled.map((change) => change.id)).toEqual([b]);

      const bRow = await prisma.task.findUniqueOrThrow({ where: { id: b }, select: { startDate: true, dueDate: true } });
      expect(bRow.startDate?.toISOString()).toBe(day(11));
      expect(bRow.dueDate?.toISOString()).toBe(day(11));
      // Sanity: Jan 12 really is a Monday.
      expect(new Date(day(11)).getUTCDay()).toBe(1);
    } finally {
      await prisma.instanceSetting.deleteMany({ where: { key: WORKING_DAYS_SETTING_KEY } });
    }
  });

  it("skips holiday dates as well as weekends", async () => {
    // Monday Jan 12 is a holiday on top of the Sat+Sun weekend.
    await setInstanceSetting(WORKING_DAYS_SETTING_KEY, {
      weekendDays: [6, 0],
      holidays: [{ date: "2026-01-12", name: "Test holiday" }],
    });
    try {
      const a = await mkTask("A6", day(4), day(4));
      const b = await mkTask("B6", day(5), day(5));
      await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

      const move = await updateTask(a, { startDate: day(8), dueDate: day(8) }, ownerId);
      expect(move.autoScheduled.map((change) => change.id)).toEqual([b]);

      const bRow = await prisma.task.findUniqueOrThrow({ where: { id: b }, select: { startDate: true, dueDate: true } });
      expect(bRow.startDate?.toISOString()).toBe(day(12)); // Tue Jan 13
    } finally {
      await prisma.instanceSetting.deleteMany({ where: { key: WORKING_DAYS_SETTING_KEY } });
    }
  });
});
