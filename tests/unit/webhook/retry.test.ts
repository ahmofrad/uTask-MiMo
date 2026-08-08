import { beforeEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    webhookFindMany: vi.fn(),
    deliveryCreate: vi.fn(),
    deliveryFindMany: vi.fn(),
    deliveryUpdate: vi.fn(),
    enqueueWebhook: vi.fn(),
    randomUUID: vi.fn(() => "event-1"),
    loggerError: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhook: { findMany: mocks.webhookFindMany },
    webhookDelivery: {
      create: mocks.deliveryCreate,
      findMany: mocks.deliveryFindMany,
      update: mocks.deliveryUpdate,
    },
  },
}));
vi.mock("@/lib/queue", () => ({ enqueueWebhook: mocks.enqueueWebhook }));
vi.mock("@/lib/crypto", () => ({ randomUUID: mocks.randomUUID }));
vi.mock("@/lib/logging", () => ({ logger: { error: mocks.loggerError, info: vi.fn() } }));

import { emitTaskEvent } from "@/lib/webhook/emit";
import { retryPendingWebhookEnqueues } from "@/lib/webhook/retry";

const webhook = { id: "webhook-1", events: ["task.created"], active: true };
const delivery = {
  id: "delivery-1",
  webhookId: "webhook-1",
  eventType: "task.created",
  eventId: "event-1",
  attemptNumber: 1,
  requestPayload: { id: "event-1", type: "task.created" },
};

describe("webhook enqueue reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.webhookFindMany.mockResolvedValue([webhook]);
    mocks.deliveryCreate.mockResolvedValue({ id: "delivery-1" });
    mocks.deliveryUpdate.mockResolvedValue({});
    mocks.deliveryFindMany.mockResolvedValue([delivery]);
    mocks.enqueueWebhook.mockResolvedValue(undefined);
  });

  it("persists a delivery and records enqueue failures for retry", async () => {
    mocks.enqueueWebhook.mockRejectedValueOnce(new Error("queue offline"));

    await expect(emitTaskEvent("task.created", "task-1", { id: "task-1" }, "actor-1")).resolves.toEqual({
      queued: 0,
      failedDeliveryIds: ["delivery-1"],
    });

    expect(mocks.deliveryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        webhookId: "webhook-1",
        eventType: "task.created",
        eventId: "event-1",
        requestPayload: expect.objectContaining({ type: "task.created" }),
        scheduledAt: expect.any(Date),
      }),
    });
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: expect.objectContaining({
        error: "Webhook queue enqueue failed: queue offline",
        nextRetryAt: expect.any(Date),
      }),
    });
  });

  it("clears enqueue error metadata after a successful retry", async () => {
    await expect(retryPendingWebhookEnqueues()).resolves.toBe(1);

    expect(mocks.enqueueWebhook).toHaveBeenCalledWith(expect.objectContaining({
      deliveryId: "delivery-1",
      eventId: "event-1",
    }));
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: { error: null, nextRetryAt: null },
    });
  });

  it("increments attempt metadata and schedules exponential retry after another failure", async () => {
    mocks.enqueueWebhook.mockRejectedValueOnce(new Error("queue still offline"));

    await expect(retryPendingWebhookEnqueues()).resolves.toBe(0);

    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: expect.objectContaining({
        attemptNumber: { increment: 1 },
        error: "Webhook queue enqueue failed: queue still offline",
        nextRetryAt: expect.any(Date),
      }),
    });
  });
});
