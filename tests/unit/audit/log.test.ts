import { describe, it, expect } from "vitest";
import { logAudit } from "@/lib/audit/log";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "test-id" }),
    },
  },
}));

// Mock logger
vi.mock("@/lib/logging", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("logAudit", () => {
  it("creates audit log entry with required fields", async () => {
    const { prisma } = await import("@/lib/db");
    await logAudit({
      actorUserId: "user-1",
      actorIp: "127.0.0.1",
      action: "login_success",
      entityType: "user",
      entityId: "user-1",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "user-1",
        actorIp: "127.0.0.1",
        action: "login_success",
        entityType: "user",
        entityId: "user-1",
      }),
    });
  });

  it("handles before/after JSON for update events", async () => {
    const { prisma } = await import("@/lib/db");
    await logAudit({
      actorUserId: "user-1",
      action: "updated",
      entityType: "task",
      entityId: "task-1",
      before: { title: "Old Title" },
      after: { title: "New Title" },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        beforeJson: { title: "Old Title" },
        afterJson: { title: "New Title" },
      }),
    });
  });

  it("does not throw on failure", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB error"),
    );

    await expect(
      logAudit({
        actorUserId: "user-1",
        action: "login_success",
        entityType: "user",
        entityId: "user-1",
      }),
    ).resolves.not.toThrow();
  });
});
