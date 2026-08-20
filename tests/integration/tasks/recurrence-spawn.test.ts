import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTask, updateTask } from "@/lib/tasks";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let ownerId = "";

maybe("task recurrence spawn (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available to own test project");
    ownerId = owner.id;
    const p = await prisma.project.create({
      data: { name: `recurrence-it-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    if (!projectId) return;
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  it("spawns the next occurrence when the current one completes", async () => {
    const dueDate = "2026-08-20T23:59:59.999Z";
    const task = await createTask({
      projectId,
      title: "Daily standup",
      reporterId: ownerId,
      createdById: ownerId,
      dueDate,
      recurrence: { freq: "DAILY", interval: 1, anchor: "dueDate", count: 2 },
    });

    const stored = await prisma.task.findUnique({ where: { id: task.id } });
    expect(stored?.recurrenceRule).not.toBeNull();
    expect(stored?.recurrenceParentId).toBeNull();

    await updateTask(task.id, { status: "done" }, ownerId);

    const spawned = await prisma.task.findFirst({ where: { recurrenceParentId: task.id } });
    expect(spawned).not.toBeNull();
    expect(spawned?.title).toBe("Daily standup");
    expect(spawned?.status).toBe("open");
    expect(spawned?.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-21");

    const childRule = JSON.parse(spawned!.recurrenceRule!) as { count?: number };
    expect(childRule.count).toBe(1);
  });

  it("stops the series when count is exhausted", async () => {
    const dueDate = "2026-08-20T23:59:59.999Z";
    const task = await createTask({
      projectId,
      title: "One more",
      reporterId: ownerId,
      createdById: ownerId,
      dueDate,
      recurrence: { freq: "DAILY", interval: 1, anchor: "dueDate", count: 0 },
    });

    await updateTask(task.id, { status: "done" }, ownerId);

    const spawned = await prisma.task.findFirst({ where: { recurrenceParentId: task.id } });
    expect(spawned).toBeNull();
  });
});
