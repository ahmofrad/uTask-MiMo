import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseMentions } from "@/lib/mentions";
import { createNotification, getUnreadCount, notifyGroupRoleChange } from "@/lib/notifications";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1", type: "mentioned" }),
      count: vi.fn().mockResolvedValue(5),
      update: vi.fn().mockResolvedValue({ id: "notif-1", readAt: new Date() }),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    ldapGroupMembership: {
      findMany: mockFindMany,
    },
  },
}));

describe("createNotification", () => {
  it("creates notification with correct type", async () => {
    const { prisma } = await import("@/lib/db");
    const result = await createNotification({
      userId: "user-1",
      type: "mentioned",
      taskId: "task-1",
    });
    expect(result.id).toBe("notif-1");
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "mentioned",
        taskId: "task-1",
      }),
    });
  });
});

describe("getUnreadCount", () => {
  it("returns count from DB", async () => {
    const count = await getUnreadCount("user-1");
    expect(count).toBe(5);
  });
});

describe("notifyGroupRoleChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifies each current member on grant", async () => {
    mockFindMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }, { userId: "u2" }]);
    await notifyGroupRoleChange({
      groupId: "g1",
      groupName: "Engineering",
      projectId: "p1",
      projectName: "Work",
      role: "contributor",
      action: "granted",
    });
    const { prisma } = await import("@/lib/db");
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { ldapSyncGroupId: "g1" },
      select: { userId: true },
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        type: "group_role_granted",
        payloadJson: expect.objectContaining({
          groupName: "Engineering",
          projectName: "Work",
          role: "contributor",
        }),
      }),
    });
  });

  it("notifies with the revoked type", async () => {
    mockFindMany.mockResolvedValue([{ userId: "u1" }]);
    await notifyGroupRoleChange({
      groupId: "g1",
      groupName: "Engineering",
      projectId: "p1",
      projectName: "Work",
      role: "lead",
      action: "revoked",
    });
    const { prisma } = await import("@/lib/db");
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "u1", type: "group_role_revoked" }),
    });
  });

  it("is a no-op for an empty group", async () => {
    mockFindMany.mockResolvedValue([]);
    await notifyGroupRoleChange({
      groupId: "g1",
      groupName: "Empty",
      projectId: "p1",
      projectName: "Work",
      role: "viewer",
      action: "granted",
    });
    const { prisma } = await import("@/lib/db");
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
