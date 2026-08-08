import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    webhookFindUnique: vi.fn(),
    deliveryCreate: vi.fn(),
    deliveryUpdate: vi.fn(),
    loggerError: vi.fn(),
    httpsRequest: vi.fn(),
    responseStatus: 200,
    responseBody: "",
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhook: { findUnique: mocks.webhookFindUnique, update: vi.fn() },
    webhookDelivery: { create: mocks.deliveryCreate, update: mocks.deliveryUpdate },
  },
}));

vi.mock("@/lib/crypto", () => ({
  hmacSign: () => "signature",
  hmacVerify: () => true,
}));

vi.mock("@/lib/crypto/encrypt", () => ({ decrypt: () => "secret" }));
vi.mock("@/lib/logging", () => ({ logger: { error: mocks.loggerError } }));
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));
vi.mock("node:https", () => ({
  request: mocks.httpsRequest,
}));

import { dispatchWebhook } from "@/lib/webhook";

describe("dispatchWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.webhookFindUnique.mockResolvedValue({
      id: "webhook-1",
      active: true,
      url: "https://example.com/webhook",
      secret: "secret",
    });
    mocks.deliveryCreate.mockResolvedValue({ id: "delivery-1" });
    mocks.deliveryUpdate.mockResolvedValue({});
    mocks.responseStatus = 200;
    mocks.responseBody = "";
    mocks.httpsRequest.mockImplementation((_options: unknown, callback: (response: EventEmitter & { statusCode: number }) => void) => {
      const request = new EventEmitter() as EventEmitter & { end: (body: string) => void };
      request.end = () => {
        const response = new EventEmitter() as EventEmitter & { statusCode: number };
        response.statusCode = mocks.responseStatus;
        callback(response);
        response.emit("data", mocks.responseBody);
        response.emit("end");
      };
      return request;
    });
  });

  it("records a non-2xx response and rejects for queue retry", async () => {
    mocks.responseStatus = 500;
    mocks.responseBody = "failure";

    await expect(
      dispatchWebhook("webhook-1", "task.created", "11111111-1111-4111-8111-111111111111", { id: "task-1" }),
    ).rejects.toThrow("HTTP 500");

    expect(mocks.deliveryUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "delivery-1" },
      data: expect.objectContaining({ responseStatus: 500, error: "Webhook returned HTTP 500" }),
    }));
  });

  it("marks a 2xx response as delivered", async () => {
    mocks.responseStatus = 202;
    mocks.responseBody = "accepted";

    await dispatchWebhook("webhook-1", "task.created", "22222222-2222-4222-8222-222222222222", { id: "task-2" });

    expect(mocks.deliveryUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "delivery-1" },
      data: expect.objectContaining({ responseStatus: 202, responseBody: "accepted", deliveredAt: expect.any(Date) }),
    }));
  });
});