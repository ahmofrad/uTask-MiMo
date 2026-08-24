import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createApiToken } from "@/lib/api-token";
import { GET as getTasks } from "@/app/api/v1/public/tasks/route";
import { GET as getProjects } from "@/app/api/v1/public/projects/route";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

async function callTasks(token: string, projectId?: string) {
  const url = projectId
    ? `http://localhost/api/v1/public/tasks?projectId=${projectId}`
    : "http://localhost/api/v1/public/tasks";
  const res = await getTasks(new Request(url, { headers: { authorization: `Bearer ${token}` } }));
  return { status: res.status, body: (await res.json()) as { data?: { id: string }[] } };
}

async function callProjects(token: string) {
  const res = await getProjects(
    new Request("http://localhost/api/v1/public/projects", { headers: { authorization: `Bearer ${token}` } }),
  );
  return { status: res.status, body: (await res.json()) as { data?: { id: string }[] } };
}

maybe("public API read scoping", () => {
  let userA = "";
  let userB = "";
  let owner = "";
  let projA = "";
  let projB = "";
  let taskA = "";
  let taskB = "";
  let tokenA = "";
  let tokenB = "";
  let tokenOwner = "";

  beforeAll(async () => {
    const a = await prisma.user.create({ data: { email: `rA-${Date.now()}@ex.com`, displayName: "A", status: "active" } });
    const b = await prisma.user.create({ data: { email: `rB-${Date.now()}@ex.com`, displayName: "B", status: "active" } });
    const o = await prisma.user.create({ data: { email: `rO-${Date.now()}@ex.com`, displayName: "O", status: "active" } });
    userA = a.id;
    userB = b.id;
    owner = o.id;
    await prisma.role.create({ data: { userId: a.id, scopeType: "global", scopeId: null, type: "member", organizationId: DEFAULT_ORGANIZATION_ID } });
    await prisma.role.create({ data: { userId: b.id, scopeType: "global", scopeId: null, type: "member", organizationId: DEFAULT_ORGANIZATION_ID } });
    await prisma.role.create({ data: { userId: o.id, scopeType: "global", scopeId: null, type: "owner", organizationId: DEFAULT_ORGANIZATION_ID } });
    await prisma.organizationMembership.create({ data: { organizationId: DEFAULT_ORGANIZATION_ID, userId: a.id, role: "member" } });
    await prisma.organizationMembership.create({ data: { organizationId: DEFAULT_ORGANIZATION_ID, userId: b.id, role: "member" } });
    await prisma.organizationMembership.create({ data: { organizationId: DEFAULT_ORGANIZATION_ID, userId: o.id, role: "owner" } });

    const pA = await prisma.project.create({ data: { name: "ProjA", ownerId: a.id } });
    const pB = await prisma.project.create({ data: { name: "ProjB", ownerId: b.id } });
    projA = pA.id;
    projB = pB.id;
    await prisma.projectMember.create({ data: { projectId: pA.id, userId: a.id, projectRole: "lead", addedBy: a.id } });
    await prisma.projectMember.create({ data: { projectId: pB.id, userId: b.id, projectRole: "lead", addedBy: b.id } });

    const tA = await prisma.task.create({ data: { projectId: pA.id, title: "taskA", reporterId: a.id, createdById: a.id } });
    const tB = await prisma.task.create({ data: { projectId: pB.id, title: "taskB", reporterId: b.id, createdById: b.id } });
    taskA = tA.id;
    taskB = tB.id;

    tokenA = (await createApiToken({ userId: a.id, name: "a", scopes: ["tasks:read", "projects:read"] })).raw;
    tokenB = (await createApiToken({ userId: b.id, name: "b", scopes: ["tasks:read", "projects:read"] })).raw;
    tokenOwner = (await createApiToken({ userId: o.id, name: "o", scopes: ["tasks:read", "projects:read"] })).raw;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: { in: [taskA, taskB] } } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [projA, projB] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projA, projB] } } });
    await prisma.apiToken.deleteMany({ where: { userId: { in: [userA, userB, owner] } } });
    await prisma.organizationMembership.deleteMany({ where: { userId: { in: [userA, userB, owner] } } });
    await prisma.role.deleteMany({ where: { userId: { in: [userA, userB, owner] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB, owner] } } });
  });

  it("scopes tasks to the caller's projects", async () => {
    const r = await callTasks(tokenA);
    expect(r.status).toBe(200);
    expect(r.body.data?.map((t) => t.id)).toEqual([taskA]);
  });

  it("returns 403 when requesting a project the caller is not a member of", async () => {
    expect((await callTasks(tokenA, projB)).status).toBe(403);
    expect((await callTasks(tokenB, projA)).status).toBe(403);
  });

  it("scopes project listings to the caller's memberships", async () => {
    const r = await callProjects(tokenA);
    expect(r.status).toBe(200);
    expect(r.body.data?.map((p) => p.id)).toEqual([projA]);
  });

  it("lets a global owner read all projects and tasks", async () => {
    const tasks = await callTasks(tokenOwner);
    expect(tasks.status).toBe(200);
    const taskIds = tasks.body.data?.map((t) => t.id) ?? [];
    expect(taskIds).toContain(taskA);
    expect(taskIds).toContain(taskB);

    const projects = await callProjects(tokenOwner);
    expect(projects.status).toBe(200);
    const projectIds = projects.body.data?.map((p) => p.id) ?? [];
    expect(projectIds).toContain(projA);
    expect(projectIds).toContain(projB);
  });
});
