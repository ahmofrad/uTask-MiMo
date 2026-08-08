import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  addDependency,
  removeDependency,
  listDependencies,
  countBlockersFor,
  evaluateStatusChange,
  wouldCreateCycle,
  updateTask,
  DependencyError,
  DependencyBlockedError,
} from "@/lib/tasks";
import { setInstanceSetting } from "@/lib/settings/instance";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let otherProjectId = "";
let ownerId = "";

async function mkTask(projectId: string, title: string, extra: Record<string, unknown> = {}) {
  const { parentTaskId, assigneeId, ...rest } = extra;
  const data: Record<string, unknown> = {
    project: { connect: { id: projectId } },
    createdBy: { connect: { id: ownerId } },
    title,
    status: "open",
    ...rest,
  };
  if (parentTaskId !== undefined) data.parentTask = { connect: { id: String(parentTaskId) } };
  if (assigneeId !== undefined) {
    data.assignees = { create: [{ user: { connect: { id: String(assigneeId) } } }] };
  }
  const t = await prisma.task.create({ data: data as never });
  return t.id;
}

maybe("task dependencies (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available");
    ownerId = owner.id;
    const p = await prisma.project.create({
      data: { name: `deps-it-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    projectId = p.id;
    const p2 = await prisma.project.create({
      data: { name: `deps-it-other-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    otherProjectId = p2.id;
  });

  afterAll(async () => {
    if (!projectId) return;
    await setInstanceSetting("tasks.dependencyEnforcement", "block", ownerId);
    await prisma.task.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
  });

  it("creates a dependency edge", async () => {
    const a = await mkTask(projectId, "A");
    const b = await mkTask(projectId, "B");
    const edge = await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });
    expect(edge.dependsOnId).toBe(a);
    expect(edge.predecessor?.id).toBe(a);
  });

  it("rejects self-dependency", async () => {
    const a = await mkTask(projectId, "Self");
    await expect(addDependency({ taskId: a, dependsOnId: a, createdBy: ownerId })).rejects.toMatchObject({
      code: "SELF",
    });
  });

  it("rejects duplicates", async () => {
    const a = await mkTask(projectId, "DupA");
    const b = await mkTask(projectId, "DupB");
    await addDependency({ taskId: b, dependsOnId: a, createdBy: ownerId });
    await expect(addDependency({ taskId: b, dependsOnId: a, createdBy: ownerId })).rejects.toMatchObject({
      code: "DUPLICATE",
      status: 409,
    });
  });

  it("rejects cross-project dependencies", async () => {
    const a = await mkTask(projectId, "X");
    const other = await mkTask(otherProjectId, "Y");
    await expect(addDependency({ taskId: a, dependsOnId: other, createdBy: ownerId })).rejects.toMatchObject({
      code: "CROSS_PROJECT",
    });
  });

  it("rejects cycles", async () => {
    const a = await mkTask(projectId, "CycA");
    const b = await mkTask(projectId, "CycB");
    const c = await mkTask(projectId, "CycC");
    await addDependency({ taskId: a, dependsOnId: b, createdBy: ownerId });
    await addDependency({ taskId: b, dependsOnId: c, createdBy: ownerId });
    expect(await wouldCreateCycle(c, a)).toBe(true);
    await expect(addDependency({ taskId: c, dependsOnId: a, createdBy: ownerId })).rejects.toMatchObject({
      code: "DEPENDENCY_CYCLE",
      status: 409,
    });
  });

  it("soft-deletes on remove and excludes from listing", async () => {
    const a = await mkTask(projectId, "RemA");
    const b = await mkTask(projectId, "RemB");
    await addDependency({ taskId: b, dependsOnId: a, createdBy: ownerId });
    await removeDependency(b, a);
    const list = await listDependencies(b);
    expect(list.outgoing).toHaveLength(0);
  });

  it("counts FS blockers for in_progress / done", async () => {
    const a = await mkTask(projectId, "CntA");
    const b = await mkTask(projectId, "CntB");
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });
    expect(await countBlockersFor(b, "in_progress")).toMatchObject({ fs: 1, ss: 0, ff: 0 });
    expect(await countBlockersFor(b, "done")).toMatchObject({ fs: 1 });
    expect(await countBlockersFor(b, "open")).toMatchObject({ fs: 0 });
  });

  it("counts SS blockers when predecessor is open", async () => {
    const a = await mkTask(projectId, "SsA");
    const b = await mkTask(projectId, "SsB");
    await addDependency({ taskId: b, dependsOnId: a, type: "START_TO_START", createdBy: ownerId });
    expect(await countBlockersFor(b, "in_progress")).toMatchObject({ ss: 1 });
  });

  it("blocks status change under enforcement=block", async () => {
    await setInstanceSetting("tasks.dependencyEnforcement", "block", ownerId);
    const a = await mkTask(projectId, "BlkA");
    const b = await mkTask(projectId, "BlkB");
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });
    const evalBlock = await evaluateStatusChange(b, "in_progress");
    expect(evalBlock.allowed).toBe(false);
    await expect(updateTask(b, { status: "in_progress" }, ownerId)).rejects.toBeInstanceOf(DependencyBlockedError);
  });

  it("allows status change under enforcement=off and warn", async () => {
    const a = await mkTask(projectId, "OffA");
    const b = await mkTask(projectId, "OffB");
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });

    await setInstanceSetting("tasks.dependencyEnforcement", "off", ownerId);
    expect((await evaluateStatusChange(b, "in_progress")).allowed).toBe(true);

    await setInstanceSetting("tasks.dependencyEnforcement", "warn", ownerId);
    const warnEval = await evaluateStatusChange(b, "in_progress");
    expect(warnEval.allowed).toBe(true);
    expect(warnEval.warn).toBe(true);
    await expect(updateTask(b, { status: "in_progress" }, ownerId)).resolves.toBeDefined();
  });

  it("notifies dependents when a predecessor is completed", async () => {
    await setInstanceSetting("tasks.dependencyEnforcement", "block", ownerId);
    const a = await mkTask(projectId, "UnbA");
    const b = await mkTask(projectId, "UnbB", { assigneeId: ownerId });
    await addDependency({ taskId: b, dependsOnId: a, type: "FINISH_TO_START", createdBy: ownerId });
    await updateTask(a, { status: "done" }, ownerId);
    const notifications = await prisma.notification.count({
      where: { type: "unblocked", taskId: b },
    });
    expect(notifications).toBeGreaterThanOrEqual(1);
    expect(await countBlockersFor(b, "in_progress")).toMatchObject({ fs: 0 });
  });
});
