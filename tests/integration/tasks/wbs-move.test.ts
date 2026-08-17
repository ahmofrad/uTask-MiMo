import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { moveTask, getWbsForProject } from "@/lib/tasks";
import { WbsGuardError } from "@/lib/tasks/wbs";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let otherProjectId = "";
let ownerId = "";

async function mkTask(projectId: string, title: string, extra: Record<string, unknown> = {}) {
  const { parentTaskId, ...rest } = extra;
  const data: Record<string, unknown> = {
    project: { connect: { id: projectId } },
    createdBy: { connect: { id: ownerId } },
    title,
    status: "open",
    ...rest,
  };
  if (parentTaskId !== undefined) {
    data.parentTask = { connect: { id: String(parentTaskId) } };
  }
  const t = await prisma.task.create({ data: data as never });
  return t.id;
}

maybe("moveTask (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available to own test project");
    ownerId = owner.id;
    const p = await prisma.project.create({
      data: { name: `wbs-it-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    projectId = p.id;
    const p2 = await prisma.project.create({
      data: { name: `wbs-it-other-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    otherProjectId = p2.id;
  });

  afterAll(async () => {
    if (!projectId) return;
    await prisma.task.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
  });

  it("reparents a leaf and recomputes WBS codes", async () => {
    // Explicit orderIndex values: sibling order is decided by orderIndex, and
    // Postgres does not guarantee a tiebreak for equal values.
    const a = await mkTask(projectId, "A", { orderIndex: 1000 });
    const b = await mkTask(projectId, "B", { orderIndex: 2000 });
    const a1 = await mkTask(projectId, "A1", { parentTaskId: a, orderIndex: 1500 });

    await moveTask(a1, { newParentId: b, position: Number.MAX_SAFE_INTEGER });

    const moved = await prisma.task.findUnique({
      where: { id: a1 },
      select: { parentTaskId: true },
    });
    expect(moved?.parentTaskId).toBe(b);

    const tree = await getWbsForProject(projectId);
    const a1Node = tree.find((n) => n.id === a1);
    expect(a1Node?.wbsCode).toBe("2.1");
  });

  it("rejects self-parent", async () => {
    const a = await mkTask(projectId, "Self");
    await expect(moveTask(a, { newParentId: a })).rejects.toMatchObject({ code: "SELF_PARENT" });
  });

  it("rejects cycles (move ancestor under descendant)", async () => {
    const a = await mkTask(projectId, "CycA");
    const a1 = await mkTask(projectId, "CycA1", { parentTaskId: a });
    const a11 = await mkTask(projectId, "CycA11", { parentTaskId: a1 });
    await expect(moveTask(a, { newParentId: a11 })).rejects.toBeInstanceOf(WbsGuardError);
    await expect(moveTask(a, { newParentId: a11 })).rejects.toMatchObject({ code: "CYCLE" });
  });

  it("rejects cross-project moves", async () => {
    const a = await mkTask(projectId, "X");
    const other = await mkTask(otherProjectId, "Y");
    await expect(moveTask(other, { newParentId: a })).rejects.toMatchObject({ code: "CROSS_PROJECT" });
  });

  it("rejects moves under a soft-deleted parent", async () => {
    const parent = await mkTask(projectId, "DelParent");
    const child = await mkTask(projectId, "DelChild");
    await prisma.task.update({ where: { id: parent }, data: { deletedAt: new Date() } });
    await expect(moveTask(child, { newParentId: parent })).rejects.toMatchObject({ code: "PARENT_DELETED" });
  });

  it("rejects moves that exceed MAX_WBS_DEPTH", async () => {
    let parent: string | null = null;
    let chain: string[] = [];
    for (let i = 0; i < 21; i++) {
      parent = await mkTask(projectId, `D${i}`, parent ? { parentTaskId: parent } : {});
      chain.push(parent);
    }
    const deep = chain[chain.length - 1];
    const extra = await mkTask(projectId, "DeepExtra");
    await expect(moveTask(extra, { newParentId: deep })).rejects.toMatchObject({ code: "MAX_DEPTH" });
  });
});
