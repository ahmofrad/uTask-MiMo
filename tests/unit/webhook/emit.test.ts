import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockCreateDelivery = vi.fn();
const mockUpdateDelivery = vi.fn();
const mockEnqueue = vi.fn();

vi.mock("@/lib/crypto", () => ({ randomUUID: () => "event-uuid" }));
vi.mock("@/lib/logging", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhook: { findMany: mockFindMany },
    webhookDelivery: { create: mockCreateDelivery, update: mockUpdateDelivery },
  },
}));

vi.mock("@/lib/queue", () => ({ enqueueWebhook: (...args: unknown[]) => mockEnqueue(...args) }));

import { emitTaskEvent } from "@/lib/webhook/emit";

const webhook = { id: "wh1", active: true, events: ["task.created"] };

describe("emitTaskEvent", () => {
  beforeEach(() => {
    mockFindMany.mockReset().mockResolvedValue([webhook]);
    mockCreateDelivery.mockReset().mockResolvedValue({ id: "del1" });
    mockUpdateDelivery.mockReset().mockResolvedValue({});
    mockEnqueue.mockReset().mockResolvedValue(undefined);
  });

  it("creates a delivery and enqueues for each subscribed webhook", async () => {
    const result = await emitTaskEvent("task.created", "t1", { title: "x" }, "u1");
    expect(result).toEqual({ queued: 1, failedDeliveryIds: [] });
    expect(mockCreateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ webhookId: "wh1", eventType: "task.created", eventId: "event-uuid" }),
      }),
    );
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId: "wh1", deliveryId: "del1" }),
    );
  });

  it("builds the event envelope with apiVersion and actor", async () => {
    await emitTaskEvent("task.created", "t1", { title: "x" }, "u1");
    const enqueueArgs = mockEnqueue.mock.calls[0]![0] as { payload: Record<string, unknown> };
    expect(enqueueArgs.payload).toMatchObject({
      id: "event-uuid",
      type: "task.created",
      apiVersion: "2024-12-01",
      actor: { id: "u1", type: "user" },
      data: { title: "x" },
    });
  });

  it("records queue failures and reports failed delivery ids", async () => {
    mockEnqueue.mockRejectedValue(new Error("queue down"));
    const result = await emitTaskEvent("task.created", "t1", {}, "u1");
    expect(result).toEqual({ queued: 0, failedDeliveryIds: ["del1"] });
    expect(mockUpdateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "del1" },
        data: expect.objectContaining({ error: expect.stringContaining("queue down") }),
      }),
    );
  });

  it("only targets webhooks subscribed to the event", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await emitTaskEvent("task.created", "t1", {}, "u1");
    expect(result).toEqual({ queued: 0, failedDeliveryIds: [] });
    expect(mockCreateDelivery).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true, events: { has: "task.created" } } }),
    );
  });
});