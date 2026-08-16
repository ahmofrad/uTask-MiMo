import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/v1/groups/[id]/members/route";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

// The only boundary mocked is auth: `requireAuth` is replaced so the route
// runs as a chosen user. Everything downstream — `canManageGroup`, department
// subtree resolution, membership writes, audit logging, idempotency — is real.
const mockAuthUser = vi.fn();
vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: () => mockAuthUser(),
}));

let managerId = "";
let memberId = "";
let targetId = "";
let deniedTargetId = "";
let groupId = "";
const suffix = `${Date.now()}`;

function groupParams() {
  return { params: Promise.resolve({ id: groupId }) };
}

function addRequest(userId: string, idempotencyKey: string): Request {
  return new Request(`http://localhost/api/v1/groups/${groupId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ userId }),
  });
}

maybe("group member add permission check", () => {
  beforeAll(async () => {
    // manager: global `manager` role AND manager of the root department.
    const manager = await prisma.user.create({
      data: { email: `mgr-${suffix}@test.local`, displayName: "Dept Manager", status: "active" },
    });
    managerId = manager.id;
    await prisma.role.create({
      data: { userId: manager.id, scopeType: "global", scopeId: null, type: "manager" },
    });

    // member: global `member` role, manages no department.
    const member = await prisma.user.create({
      data: { email: `member-${suffix}@test.local`, displayName: "Plain Member", status: "active" },
    });
    memberId = member.id;
    await prisma.role.create({
      data: { userId: member.id, scopeType: "global", scopeId: null, type: "member" },
    });

    // target: the user who gets added to the group.
    const target = await prisma.user.create({
      data: { email: `target-${suffix}@test.local`, displayName: "Target User", status: "active" },
    });
    targetId = target.id;

    // deniedTarget: a fresh user used only by the permission-denied test, so
    // it is never a member before that test runs.
    const deniedTarget = await prisma.user.create({
      data: { email: `denied-${suffix}@test.local`, displayName: "Denied Target", status: "active" },
    });
    deniedTargetId = deniedTarget.id;

    // Department tree: root managed by the manager, child under root. The
    // manager's subtree therefore contains both departments.
    const root = await prisma.department.create({
      data: { name: `Root ${suffix}`, managerUserId: manager.id },
    });
    const child = await prisma.department.create({
      data: { name: `Child ${suffix}`, parentId: root.id },
    });

    // Group owned by the child department — inside the manager's subtree.
    const group = await prisma.ldapSyncGroup.create({
      data: { name: `Team ${suffix}`, source: "manual", ownerDepartmentId: child.id },
    });
    groupId = group.id;
  });

  afterAll(async () => {
    await prisma.ldapGroupMembership.deleteMany({ where: { ldapSyncGroupId: groupId } });
    await prisma.auditLog.deleteMany({ where: { entityId: groupId } });
    await prisma.ldapSyncGroup.deleteMany({ where: { id: groupId } });
    await prisma.department.deleteMany({
      where: { name: { in: [`Root ${suffix}`, `Child ${suffix}`] } },
    });
    await prisma.role.deleteMany({
      where: { userId: { in: [managerId, memberId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [managerId, memberId, targetId, deniedTargetId] } },
    });
  });

  it("allows a manager to add a member to a group in their department subtree", async () => {
    mockAuthUser.mockResolvedValue({ userId: managerId });
    const response = await POST(addRequest(targetId, `mgr-${suffix}`), groupParams());
    expect(response.status).toBe(201);

    const membership = await prisma.ldapGroupMembership.findUnique({
      where: { userId_ldapSyncGroupId: { userId: targetId, ldapSyncGroupId: groupId } },
    });
    expect(membership).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "group_member_added", entityId: groupId },
    });
    expect(audit?.actorUserId).toBe(managerId);
  });

  it("denies a plain member even though the group belongs to a department", async () => {
    mockAuthUser.mockResolvedValue({ userId: memberId });
    const response = await POST(addRequest(deniedTargetId, `member-${suffix}`), groupParams());
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("FORBIDDEN");

    // No membership row was created and no audit event was emitted.
    const membership = await prisma.ldapGroupMembership.findUnique({
      where: { userId_ldapSyncGroupId: { userId: deniedTargetId, ldapSyncGroupId: groupId } },
    });
    expect(membership).toBeNull();
    const audit = await prisma.auditLog.findFirst({
      where: { action: "group_member_added", entityId: groupId, actorUserId: memberId },
    });
    expect(audit).toBeNull();
  });
});
