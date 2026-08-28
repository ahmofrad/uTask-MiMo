import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { prisma } from "@/lib/db";

let testUserId = "";

beforeAll(async () => {
  // Create a test user for notification tests
  const user = await prisma.user.upsert({
    where: { email: "notification-test@utask.local" },
    update: {},
    create: {
      email: "notification-test@utask.local",
      displayName: "Notification Test User",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  testUserId = user.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
});

beforeEach(async () => {
  await prisma.notification.deleteMany({ where: { userId: testUserId } });
});

describe("notification delivery integration", () => {
  it("creates a notification and counts it as unread", async () => {
    const { createNotification, getUnreadCount } = await import("@/lib/notifications");

    const notification = await createNotification({
      userId: testUserId,
      type: "assigned",
      taskId: undefined,
      payload: { taskName: "Test task" },
    });
    expect(notification.id).toBeDefined();
    expect(notification.userId).toBe(testUserId);

    const count = await getUnreadCount(testUserId);
    expect(count).toBe(1);
  });

  it("notify() never throws even on invalid input", async () => {
    const { notify } = await import("@/lib/notifications");

    // Should not throw — notify catches internally
    await expect(
      notify({ userId: "nonexistent-user-id", type: "commented" }),
    ).resolves.toBeUndefined();
  });

  it("marks a notification as read", async () => {
    const { createNotification, markAsRead, getUnreadCount } = await import("@/lib/notifications");

    const n = await createNotification({
      userId: testUserId,
      type: "status_changed",
    });

    const count = await markAsRead(n.id, testUserId);
    expect(count).toBe(1);

    const unread = await getUnreadCount(testUserId);
    expect(unread).toBe(0);
  });

  it("marks all notifications as read", async () => {
    const { createNotification, markAllAsRead, getUnreadCount } = await import("@/lib/notifications");

    await createNotification({ userId: testUserId, type: "assigned" });
    await createNotification({ userId: testUserId, type: "mentioned" });
    await createNotification({ userId: testUserId, type: "commented" });

    expect(await getUnreadCount(testUserId)).toBe(3);

    await markAllAsRead(testUserId);
    expect(await getUnreadCount(testUserId)).toBe(0);
  });

  it("does not double-count already-read notifications", async () => {
    const { createNotification, markAllAsRead, getUnreadCount } = await import("@/lib/notifications");

    await createNotification({ userId: testUserId, type: "assigned" });
    await markAllAsRead(testUserId);
    await createNotification({ userId: testUserId, type: "mentioned" });

    expect(await getUnreadCount(testUserId)).toBe(1);
  });

  it("markAsRead is idempotent", async () => {
    const { createNotification, markAsRead } = await import("@/lib/notifications");

    const n = await createNotification({ userId: testUserId, type: "due_soon" });
    const first = await markAsRead(n.id, testUserId);
    expect(first).toBe(1);
    const second = await markAsRead(n.id, testUserId);
    expect(second).toBe(0); // Already read — no-op
  });
});
