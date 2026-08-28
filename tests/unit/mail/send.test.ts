import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/queue", () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhook: { findUnique: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe("mail/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifyAssigned enqueues email with escaped title", async () => {
    const { enqueueEmail } = await import("@/lib/queue");
    const { notifyAssigned } = await import("@/lib/mail/send");

    await notifyAssigned("user@test.com", "Task <script>", "http://t/1");

    expect(enqueueEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(enqueueEmail).mock.calls[0]![0];
    expect(call.to).toBe("user@test.com");
    expect(call.subject).toContain("Task <script>");
    expect(call.html).not.toContain("<script>");
    expect(call.html).toContain("&lt;script&gt;");
  });

  it("notifyMentioned enqueues email with both names escaped", async () => {
    const { enqueueEmail } = await import("@/lib/queue");
    const { notifyMentioned } = await import("@/lib/mail/send");

    await notifyMentioned(
      "a@b.com",
      "<b>Admin</b>",
      "Task & Title",
      "http://t/2",
    );

    expect(enqueueEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(enqueueEmail).mock.calls[0]![0];
    expect(call.to).toBe("a@b.com");
    expect(call.html).toContain("&lt;b&gt;Admin&lt;/b&gt;");
    expect(call.html).toContain("Task &amp; Title");
  });
});
