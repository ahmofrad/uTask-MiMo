import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { addDependency } from "@/lib/tasks/dependencies";
import { getProjectDependencyStatusMap } from "@/lib/tasks/dependency-status-queries";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let projectId = "";
let ownerId = "";

maybe("dependency status map (integration)", () => {
  beforeAll(async () => {
    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("no user available");
    ownerId = owner.id;
    const project = await prisma.project.create({
      data: { name: `dep-status-it-${Date.now()}`, owner: { connect: { id: owner.id } } },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (!projectId) return;
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  async function mkTask(title: string, done = false): Promise<string> {
    const task = await prisma.task.create({
      data: {
        project: { connect: { id: projectId } },
        createdBy: { connect: { id: ownerId } },
        title,
        status: done ? "done" : "open",
      } as never,
    });
    return task.id;
  }

  it("reports incomplete predecessors as blockers and skips completed ones", async () => {
    const done = await mkTask("Finished", true);
    const inProgress = await mkTask("In progress");
    const open = await mkTask("Open");
    const related = await mkTask("Related");
    const dependent = await mkTask("Dependent");

    await addDependency({ taskId: dependent, dependsOnId: done, type: "FINISH_TO_START", createdBy: ownerId });
    await addDependency({ taskId: dependent, dependsOnId: inProgress, type: "FINISH_TO_START", createdBy: ownerId });
    await addDependency({ taskId: dependent, dependsOnId: open, type: "START_TO_START", createdBy: ownerId });
    // RELATES_TO never blocks.
    await addDependency({ taskId: dependent, dependsOnId: related, type: "RELATES_TO", createdBy: ownerId });

    const map = await getProjectDependencyStatusMap([projectId]);
    const status = map.get(dependent);
    expect(status).toBeDefined();
    expect(status!.blockedBy.map((b) => b.id).sort()).toEqual([inProgress, open].sort());
    // The completed predecessor and the RELATES_TO edge are excluded.
    expect(status!.blockedBy.some((b) => b.id === done)).toBe(false);
    expect(status!.blockedBy.some((b) => b.id === related)).toBe(false);
    expect(status!.blockedBy.every((b) => b.title.length > 0)).toBe(true);

    // Tasks with no incomplete predecessors are absent from the map.
    expect(map.has(done)).toBe(false);
    expect(map.has(inProgress)).toBe(false);
  });

  it("returns an empty map for an unknown project", async () => {
    const map = await getProjectDependencyStatusMap(["00000000-0000-4000-8000-000000000000"]);
    expect(map.size).toBe(0);
  });

  it("returns an empty map for no projects", async () => {
    const map = await getProjectDependencyStatusMap([]);
    expect(map.size).toBe(0);
  });
});
