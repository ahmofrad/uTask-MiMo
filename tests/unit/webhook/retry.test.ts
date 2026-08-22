import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockUpdate, mockEnqueue } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockEnqueue: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    webhookDelivery: { findMany: mockFindMany, update: mockUpdate },
  },
}));
vi.mock("@/lib/queue", () => ({ enqueueWebhook: (...args: unknown[]) => mockEnqueue(...args) }));

import { retryPendingWebhookEnqueues } from "@/lib/webhook/retry";

const pendingDelivery = {
  id: "del1",
  webhookId: "wh1",
  eventType: "task.created",
  eventId: "evt1",
  attemptNumber: 1,
  requestPayload: { id: "evt1", type: "task.created" },
};

describe("retryPendingWebhookEnqueues", () => {
  beforeEach(() => {
    mockFindMany.mockReset().mockResolvedValue([pendingDelivery]);
    mockUpdate.mockReset().mockResolvedValue({});
    mockEnqueue.mockReset().mockResolvedValue(undefined);
  });

  it("enqueues due deliveries and clears their error", async () => {
    const count = await retryPendingWebhookEnqueues();
    expect(count).toBe(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId: "wh1", deliveryId: "del1" }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "del1" }, data: { error: null, nextRetryAt: null } }),
    );
  });

  it("skips deliveries with invalid persisted payloads", async () => {
    mockFindMany.mockResolvedValue([{ ...pendingDelivery, requestPayload: "not-an-object" }]);
    const count = await retryPendingWebhookEnqueues();
    expect(count).toBe(0);
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "del1" },
        data: expect.objectContaining({ error: expect.stringContaining("invalid persisted payload") }),
      }),
    );
  });

  it("increments attempt and schedules backoff when enqueue fails", async () => {
    mockEnqueue.mockRejectedValue(new Error("redis down"));
    const count = await retryPendingWebhookEnqueues();
    expect(count).toBe(0);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "del1" },
        data: expect.objectContaining({
          attemptNumber: { increment: 1 },
          error: expect.stringContaining("redis down"),
          nextRetryAt: expect.any(Date),
        }),
      }),
    );
  });

  it("queries only due enqueue-failed deliveries on active webhooks", async () => {
    await retryPendingWebhookEnqueues(50);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deliveredAt: null,
          nextRetryAt: { lte: expect.any(Date) },
          error: { startsWith: "Webhook queue enqueue failed:" },
          webhook: { active: true, deletedAt: null },
        },
        orderBy: { nextRetryAt: "asc" },
        take: 50,
      }),
    );
  });
});