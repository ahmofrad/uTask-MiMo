import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  webhook: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
};
const mockEnqueueEmail = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ enqueueEmail: mockEnqueueEmail }));
vi.mock("@/lib/logging", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { notifyWebhookDeadLetter } = await import("@/lib/mail/send");

describe("notifyWebhookDeadLetter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emails every global admin/owner with the webhook and event details", async () => {
    mockPrisma.webhook.findUnique.mockResolvedValue({
      name: "CI Hook",
      url: "https://ci.example.com/hook",
    });
    mockPrisma.user.findMany.mockResolvedValue([
      { email: "owner@utask.local" },
      { email: "admin@utask.local" },
    ]);

    await notifyWebhookDeadLetter({
      webhookId: "wh-1",
      eventType: "task.created",
      eventId: "evt-1",
      error: "Webhook returned HTTP 500",
    });

    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    expect(mockEnqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@utask.local",
        subject: expect.stringContaining("CI Hook"),
      }),
    );

    const first = mockEnqueueEmail.mock.calls[0]![0] as {
      text: string;
      html: string;
    };
    expect(first.text).toContain("Event: task.created");
    expect(first.text).toContain("Last error: Webhook returned HTTP 500");
    expect(first.text).toContain("https://ci.example.com/hook");
    expect(first.html).toContain("CI Hook");
  });

  it("skips enqueueing when there are no global admins", async () => {
    mockPrisma.webhook.findUnique.mockResolvedValue({
      name: "CI Hook",
      url: "https://ci.example.com/hook",
    });
    mockPrisma.user.findMany.mockResolvedValue([]);

    await notifyWebhookDeadLetter({
      webhookId: "wh-1",
      eventType: "task.created",
      eventId: "evt-1",
    });

    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("falls back to the webhook id when the webhook row is gone", async () => {
    mockPrisma.webhook.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([{ email: "admin@utask.local" }]);

    await notifyWebhookDeadLetter({
      webhookId: "wh-gone",
      eventType: "task.created",
      eventId: "evt-1",
    });

    expect(mockEnqueueEmail).toHaveBeenCalledTimes(1);
    expect(mockEnqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("wh-gone") }),
    );
  });
});
