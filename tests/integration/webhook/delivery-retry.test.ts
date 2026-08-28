import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

beforeAll(async () => {
  // Ensure a test project exists
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Organization" (id, name, "createdAt", "updatedAt")
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Test Org', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Webhook delivery lifecycle", () => {
  it("creates and lists webhook deliveries", async () => {
    // Create a webhook
    const webhook = await prisma.webhook.create({
      data: {
        organizationId: "00000000-0000-4000-8000-0000000000a1",
        url: "https://httpbin.org/post",
        events: ["task.created"],
        secret: "test-secret-hash",
        createdBy: "00000000-0000-4000-8000-0000000000a1",
      },
    });

    // Create a delivery record
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: "task.created",
        payload: JSON.stringify({ event: "task.created", data: { id: "task-1" } }),
        attemptNumber: 1,
        status: "pending",
      },
    });

    expect(delivery.id).toBeDefined();
    expect(delivery.status).toBe("pending");
    expect(delivery.attemptNumber).toBe(1);

    // Simulate a successful delivery
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "delivered", deliveredAt: new Date(), responseStatus: 200 },
    });

    const updated = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
    expect(updated?.status).toBe("delivered");
    expect(updated?.responseStatus).toBe(200);

    // Simulate a failed delivery with retry
    const retryDelivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: "task.updated",
        payload: JSON.stringify({ event: "task.updated", data: { id: "task-2" } }),
        attemptNumber: 1,
        status: "failed",
        error: "Connection refused",
      },
    });

    // Schedule retry
    const nextRetryAt = new Date(Date.now() + 5000);
    await prisma.webhookDelivery.update({
      where: { id: retryDelivery.id },
      data: { attemptNumber: 2, scheduledAt: nextRetryAt },
    });

    const retried = await prisma.webhookDelivery.findUnique({ where: { id: retryDelivery.id } });
    expect(retried?.attemptNumber).toBe(2);

    // Cleanup
    await prisma.webhookDelivery.deleteMany({ where: { webhookId: webhook.id } });
    await prisma.webhook.delete({ where: { id: webhook.id } });
  });
});
