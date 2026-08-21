import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createPeriod, addEntry, transitionPeriod, listPeriods } from "@/lib/timesheets";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let departmentId = "";
let ownerId = "";
let projectId = "";
let cardId = "";

maybe("timesheet flow (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available");
    ownerId = owner.id;

    const department = await prisma.department.create({ data: { name: `ts-dept-${Date.now()}` } });
    departmentId = department.id;

    const project = await prisma.project.create({
      data: { name: `ts-project-${Date.now()}`, owner: { connect: { id: ownerId } } },
    });
    projectId = project.id;

    const card = await prisma.rateCard.create({
      data: {
        scope: "user",
        userId: ownerId,
        costRateMinor: 6500,
        currency: "USD",
        effectiveFrom: new Date("2020-01-01T00:00:00Z"),
      },
    });
    cardId = card.id;
  });

  afterAll(async () => {
    if (cardId) await prisma.rateCard.deleteMany({ where: { id: cardId } });
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (departmentId) await prisma.department.deleteMany({ where: { id: departmentId } });
  });

  it("creates a period, logs an entry with a rate snapshot, and approves", async () => {
    const period = await createPeriod({
      departmentId,
      ownerId,
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-08-07T23:59:59Z"),
    });
    expect(period.status).toBe("open");

    const entry = await addEntry({
      periodId: period.id,
      userId: ownerId,
      projectId,
      minutes: 120,
      billable: true,
    });
    expect(entry.costRateMinorSnapshot).toBe(6500);
    expect(entry.currencySnapshot).toBe("USD");
    expect(entry.minutes).toBe(120);

    // Owner submits.
    await transitionPeriod(period.id, "submit");
    let reloaded = await prisma.timesheetPeriod.findUnique({ where: { id: period.id } });
    expect(reloaded?.status).toBe("submitted");

    // Approver approves.
    await transitionPeriod(period.id, "approve");
    reloaded = await prisma.timesheetPeriod.findUnique({ where: { id: period.id } });
    expect(reloaded?.status).toBe("approved");

    // Reopen from approved.
    await transitionPeriod(period.id, "reopen");
    reloaded = await prisma.timesheetPeriod.findUnique({ where: { id: period.id } });
    expect(reloaded?.status).toBe("reopened");
  });

  it("rejects adding an entry to an approved period", async () => {
    const period = await createPeriod({
      departmentId,
      ownerId,
      periodStart: new Date("2026-08-08T00:00:00Z"),
      periodEnd: new Date("2026-08-14T23:59:59Z"),
    });
    await transitionPeriod(period.id, "submit");
    await transitionPeriod(period.id, "approve");

    await expect(
      addEntry({ periodId: period.id, userId: ownerId, projectId, minutes: 30, billable: true }),
    ).rejects.toMatchObject({ code: "PERIOD_NOT_EDITABLE" });
  });

  it("lists only the requested owner's periods when scoped", async () => {
    const mine = await createPeriod({
      departmentId,
      ownerId,
      periodStart: new Date("2026-08-15T00:00:00Z"),
      periodEnd: new Date("2026-08-21T23:59:59Z"),
    });
    const others = await prisma.timesheetPeriod.findMany({
      where: { departmentId, ownerId },
      orderBy: { periodStart: "desc" },
    });
    expect(others.some((p) => p.id === mine.id)).toBe(true);

    const scoped = await listPeriods({ departmentId, ownerId });
    expect(scoped.every((p) => p.ownerId === ownerId)).toBe(true);
  });
});
