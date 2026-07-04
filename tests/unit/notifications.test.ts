import { describe, it, expect } from "vitest";
import { parseMentions } from "@/lib/mentions";
import { createNotification, getUnreadCount } from "@/lib/notifications";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1", type: "mentioned" }),
      count: vi.fn().mockResolvedValue(5),
      update: vi.fn().mockResolvedValue({ id: "notif-1", readAt: new Date() }),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
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
