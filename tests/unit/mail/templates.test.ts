import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSettings = vi.fn();

vi.mock("@/lib/settings", () => ({
  getSettings: mockGetSettings,
  updateSettings: vi.fn(),
}));

const { renderTemplate, getMailTemplates, DEFAULT_MAIL_TEMPLATES } = await import("@/lib/mail/templates");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({});
});

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    expect(renderTemplate("Hello {{name}}, link: {{link}}", { name: "Jane", link: "https://x/invite/abc" }))
      .toBe("Hello Jane, link: https://x/invite/abc");
  });

  it("renders numbers and leaves unknown placeholders empty", () => {
    expect(renderTemplate("Expires in {{expiryDays}} days ({{missing}})", { expiryDays: 7 }))
      .toBe("Expires in 7 days ()");
  });
});

describe("getMailTemplates", () => {
  it("returns the defaults when no overrides are stored", async () => {
    const templates = await getMailTemplates();
    expect(templates.invite.subject).toBe(DEFAULT_MAIL_TEMPLATES.invite.subject);
    expect(templates.passwordReset.subject).toBe(DEFAULT_MAIL_TEMPLATES.passwordReset.subject);
  });

  it("merges admin overrides over the defaults", async () => {
    mockGetSettings.mockResolvedValue({
      mailTemplates: {
        invite: { subject: "Join the team!" },
        passwordReset: { text: "Reset at {{link}}", html: "<p><a href=\"{{link}}\">go</a></p>" },
      },
    });

    const templates = await getMailTemplates();
    expect(templates.invite.subject).toBe("Join the team!");
    // Untouched fields fall back to the default.
    expect(templates.invite.text).toBe(DEFAULT_MAIL_TEMPLATES.invite.text);
    expect(templates.passwordReset.text).toBe("Reset at {{link}}");
    expect(templates.passwordReset.html).toBe("<p><a href=\"{{link}}\">go</a></p>");
  });

  it("falls back to defaults when an override is blank", async () => {
    mockGetSettings.mockResolvedValue({
      mailTemplates: { invite: { subject: "   " } },
    });

    const templates = await getMailTemplates();
    expect(templates.invite.subject).toBe(DEFAULT_MAIL_TEMPLATES.invite.subject);
  });
});
