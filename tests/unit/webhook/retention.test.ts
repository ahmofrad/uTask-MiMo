import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecuteRaw, mockInfo } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
  mockInfo: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { $executeRaw: mockExecuteRaw },
}));
vi.mock("@/lib/logging", () => ({
  logger: { info: mockInfo },
}));

import { pruneWebhookDeliveries } from "@/lib/webhook/retention";

describe("pruneWebhookDeliveries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEBHOOK_DELIVERY_RETENTION_DAYS;
  });

  it("deletes in batches until the final short batch", async () => {
    mockExecuteRaw.mockResolvedValueOnce(5_000).mockResolvedValueOnce(17);

    const deleted = await pruneWebhookDeliveries();

    expect(deleted).toBe(5_017);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeleted: 5_017, retentionDays: 30 }),
      "Webhook delivery retention completed",
    );
  });

  it("uses the configured retention window and does not log empty sweeps", async () => {
    process.env.WEBHOOK_DELIVERY_RETENTION_DAYS = "90";
    mockExecuteRaw.mockResolvedValue(0);

    const deleted = await pruneWebhookDeliveries();

    expect(deleted).toBe(0);
    expect(mockExecuteRaw).toHaveBeenCalledOnce();
    expect(mockInfo).not.toHaveBeenCalled();
  });
});
