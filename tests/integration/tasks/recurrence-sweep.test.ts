import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { sweepRecurringTasks } from "@/lib/tasks/recurrence";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let ownerId = "";
const createdTaskIds: string[] = [];

maybe("task recurrence sweep (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available to own test project");
    ownerId = owner.id;
    const p = await prisma.project.create({
      data: { name: `recurrence-sweep-it-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    projectId = p.id;
  });

  afterEach(async () => {
    // Remove every task this test created plus any children the sweep spawned,
    // so the global sweep never observes leftovers from a sibling test.
    if (createdTaskIds.length === 0) return;
    await prisma.task.deleteMany({
      where: { OR: [{ id: { in: createdTaskIds } }, { recurrenceParentId: { in: createdTaskIds } }] },
    });
    createdTaskIds.length = 0;
  });

  afterAll(async () => {
    if (!projectId) return;
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  it("spawns a child whose next occurrence is in the past", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        title: "Backfilled daily",
        reporterId: ownerId,
        createdById: ownerId,
        dueDate: new Date("2020-01-01T23:59:59.999Z"),
        recurrenceRule: JSON.stringify({ freq: "DAILY", interval: 1, anchor: "dueDate" }),
      },
    });
    createdTaskIds.push(task.id);

    await sweepRecurringTasks(prisma.task);

    const child = await prisma.task.findFirst({ where: { recurrenceParentId: task.id } });
    expect(child).not.toBeNull();
    expect(child?.status).toBe("open");
    expect(child?.title).toBe("Backfilled daily");
  });

  it("does not spawn when the next occurrence is still in the future", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        title: "Future daily",
        reporterId: ownerId,
        createdById: ownerId,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        recurrenceRule: JSON.stringify({ freq: "DAILY", interval: 1, anchor: "dueDate" }),
      },
    });
    createdTaskIds.push(task.id);

    await sweepRecurringTasks(prisma.task);

    const child = await prisma.task.findFirst({ where: { recurrenceParentId: task.id } });
    expect(child).toBeNull();
  });

  it("does not spawn a second child at the same date slot", async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        title: "Dedup daily",
        reporterId: ownerId,
        createdById: ownerId,
        dueDate: new Date("2020-01-01T23:59:59.999Z"),
        recurrenceRule: JSON.stringify({ freq: "DAILY", interval: 1, anchor: "dueDate" }),
      },
    });
    createdTaskIds.push(task.id);

    await sweepRecurringTasks(prisma.task);
    const firstSweepChildren = await prisma.task.findMany({
      where: { recurrenceParentId: task.id },
      select: { dueDate: true },
      orderBy: { dueDate: "asc" },
    });
    expect(firstSweepChildren).toHaveLength(1);
    const firstDue = firstSweepChildren[0]!.dueDate!.toISOString();

    // A second sweep must not create another child at the same date slot (the
    // catch-up path advances one period per sweep, so the next child lands on
    // the following day — never a duplicate of the first).
    await sweepRecurringTasks(prisma.task);
    const sameSlot = await prisma.task.count({
      where: { recurrenceParentId: task.id, dueDate: new Date(firstDue) },
    });
    expect(sameSlot).toBe(1);
  });
});