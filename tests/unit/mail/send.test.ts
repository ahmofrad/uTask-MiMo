import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSettings = vi.fn();

vi.mock("@/lib/settings", () => ({
  getSettings: mockGetSettings,
  updateSettings: vi.fn(),
}));

const { isMailConfigured, resetCache } = await import("@/lib/mail/send");
const { MAIL_PREVIEW_VARS, renderTemplate, DEFAULT_MAIL_TEMPLATES } = await import("@/lib/mail/templates");

describe("MAIL_PREVIEW_VARS", () => {
  it("provides every placeholder used by the default templates", () => {
    for (const set of Object.values(DEFAULT_MAIL_TEMPLATES)) {
      const rendered = renderTemplate(`${set.subject} ${set.text} ${set.html}`, MAIL_PREVIEW_VARS);
      expect(rendered).not.toMatch(/\{\{/);
    }
  });
});

describe("isMailConfigured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCache();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it("is false when no SMTP config exists", async () => {
    mockGetSettings.mockResolvedValue({});
    expect(await isMailConfigured()).toBe(false);
  });

  it("is true when SMTP is configured in DB settings", async () => {
    mockGetSettings.mockResolvedValue({ smtp: { host: "smtp.example.com", port: 587 } });
    expect(await isMailConfigured()).toBe(true);
  });

  it("is true when SMTP_HOST env var is set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    expect(await isMailConfigured()).toBe(true);
  });

  it("falls back to env vars when the settings table is unavailable", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    mockGetSettings.mockRejectedValue(new Error("relation does not exist"));
    expect(await isMailConfigured()).toBe(true);
  });
});
