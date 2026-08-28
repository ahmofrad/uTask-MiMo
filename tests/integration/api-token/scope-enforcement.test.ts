import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createApiToken } from "@/lib/api-token";
import { POST as createTask } from "@/app/api/v1/public/tasks/route";
import { POST as createProject } from "@/app/api/v1/public/projects/route";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

/**
 * G6-scoped integration tests: verify that the public API scope-check
 * middleware enforces scope requirements on write endpoints.
 *
 * These tests exercise `authenticatePublicApi(request, requiredScope)`
 * against a real DB-backed token.
 */
maybe("public API scope enforcement (integration)", () => {
  let userId = "";
  let projectId = "";
  let readToken = "";
  let writeToken = "";
  let allScopesToken = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `scope-enf-${Date.now()}@example.com`,
        displayName: "Scope Enforcer",
        status: "active",
      },
    });
    userId = user.id;

    await prisma.role.create({
      data: { userId, scopeType: "global", scopeId: null, type: "owner", organizationId: DEFAULT_ORGANIZATION_ID },
    });
    await prisma.organizationMembership.create({
      data: { organizationId: DEFAULT_ORGANIZATION_ID, userId, role: "owner" },
    });

    const project = await prisma.project.create({
      data: { name: `scope-proj-${Date.now()}`, ownerId: userId, visibility: "org" },
    });
    projectId = project.id;
    await prisma.projectMember.create({
      data: { projectId, userId, projectRole: "lead", addedBy: userId },
    });

    readToken = (await createApiToken({ userId, name: "read-only", scopes: ["tasks:read", "projects:read"] })).raw;
    writeToken = (await createApiToken({ userId, name: "write-only", scopes: ["tasks:write"] })).raw;
    allScopesToken = (await createApiToken({ userId, name: "all-scopes", scopes: ["tasks:read", "tasks:write", "projects:read", "projects:write"] })).raw;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.task.deleteMany({ where: { projectId } });
      await prisma.projectMember.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    if (userId) {
      await prisma.apiToken.deleteMany({ where: { userId } });
      await prisma.role.deleteMany({ where: { userId } });
      await prisma.organizationMembership.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("read-only token is rejected on POST /tasks (tasks:write required)", async () => {
    const res = await createTask(
      new Request("http://localhost/api/v1/public/tasks", {
        method: "POST",
        headers: {
          authorization: `Bearer ${readToken}`,
          "content-type": "application/json",
          "idempotency-key": `scope-test-${Date.now()}`,
        },
        body: JSON.stringify({
          projectId,
          title: "Should be rejected",
        }),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("tasks:write");
  });

  it("write-only token can create a task", async () => {
    const res = await createTask(
      new Request("http://localhost/api/v1/public/tasks", {
        method: "POST",
        headers: {
          authorization: `Bearer ${writeToken}`,
          "content-type": "application/json",
          "idempotency-key": `scope-test-write-${Date.now()}`,
        },
        body: JSON.stringify({
          projectId,
          title: "Created with write token",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; title: string } };
    expect(body.data.title).toBe("Created with write token");
  });

  it("read-only token can GET tasks", async () => {
    const { GET: getTasks } = await import("@/app/api/v1/public/tasks/route");
    const res = await getTasks(
      new Request(`http://localhost/api/v1/public/tasks?projectId=${projectId}`, {
        headers: { authorization: `Bearer ${readToken}` },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("missing token is rejected with 401", async () => {
    const res = await createTask(
      new Request("http://localhost/api/v1/public/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, title: "No auth" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("revoked token is rejected with 401", async () => {
    const tempToken = await createApiToken({ userId, name: "temp", scopes: ["tasks:write"] });
    await prisma.apiToken.update({ where: { id: tempToken.id }, data: { revokedAt: new Date() } });

    const res = await createTask(
      new Request("http://localhost/api/v1/public/tasks", {
        method: "POST",
        headers: {
          authorization: `Bearer ${tempToken.raw}`,
          "content-type": "application/json",
          "idempotency-key": `revoked-${Date.now()}`,
        },
        body: JSON.stringify({ projectId, title: "Revoked" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
