import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockLogAudit = vi.fn();
const mockGetMailTemplates = vi.fn();
const mockSendMail = vi.fn();
const mockIsMailConfigured = vi.fn();
const mockRenderTemplate = vi.fn((tpl: string, vars: Record<string, unknown>) => {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ""));
});

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/mail/templates", () => ({
  getMailTemplates: mockGetMailTemplates,
  renderTemplate: mockRenderTemplate,
  MAIL_PREVIEW_VARS: { email: "preview@example.com", link: "https://example.com/invite", expiryDays: 7 },
}));
vi.mock("@/lib/mail/send", () => ({
  sendMail: mockSendMail,
  isMailConfigured: mockIsMailConfigured,
}));

const route = await import("@/app/api/v1/admin/settings/email-templates/test/route");

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

const DEFAULT_TEMPLATES = {
  invite: { subject: "You've been invited to uTask", text: "Text {{link}}", html: "<p>{{link}}</p>" },
  passwordReset: { subject: "Reset your uTask password", text: "Reset {{link}}", html: "" },
};

function authGuardOk() {
  mockRequireAuth.mockResolvedValue({ userId: ADMIN_ID });
  mockRequirePermission.mockReturnValue(vi.fn().mockResolvedValue(null));
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/admin/settings/email-templates/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authGuardOk();
  mockGetMailTemplates.mockResolvedValue(DEFAULT_TEMPLATES);
  mockIsMailConfigured.mockResolvedValue(true);
  mockSendMail.mockResolvedValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/v1/admin/settings/email-templates/test", () => {
  it("sends the invite template with preview vars and audits", async () => {
    const response = await route.POST(jsonRequest({ key: "invite", to: "admin@example.com" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { sent: true } });
    expect(mockSendMail).toHaveBeenCalledWith({
      to: "admin@example.com",
      subject: "You've been invited to uTask",
      text: "Text https://example.com/invite",
      html: "<p>https://example.com/invite</p>",
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ADMIN_ID,
        action: "mail_test_sent",
        entityType: "settings",
        entityId: "email-templates",
        after: { template: "invite", to: "admin@example.com" },
      }),
    );
  });

  it("sends the reset template", async () => {
    const response = await route.POST(jsonRequest({ key: "reset", to: "admin@example.com" }));

    expect(response.status).toBe(200);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reset your uTask password",
        text: "Reset https://example.com/invite",
      }),
    );
  });

  it("rejects invalid recipients", async () => {
    const response = await route.POST(jsonRequest({ key: "invite", to: "not-an-email" }));
    expect(response.status).toBe(400);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("rejects unknown template keys", async () => {
    const response = await route.POST(jsonRequest({ key: "nope", to: "admin@example.com" }));
    expect(response.status).toBe(400);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("fails with SMTP_NOT_CONFIGURED when mail is not configured", async () => {
    mockIsMailConfigured.mockResolvedValue(false);
    const response = await route.POST(jsonRequest({ key: "invite", to: "admin@example.com" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "SMTP_NOT_CONFIGURED", message: "SMTP is not configured" },
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns 502 when delivery fails and does not audit", async () => {
    mockSendMail.mockRejectedValue(new Error("smtp down"));
    const response = await route.POST(jsonRequest({ key: "invite", to: "admin@example.com" }));
    expect(response.status).toBe(502);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("denies users without org:settings", async () => {
    mockRequirePermission.mockReturnValue(
      vi.fn().mockResolvedValue(new NextResponse(null, { status: 403 })),
    );
    const response = await route.POST(jsonRequest({ key: "invite", to: "admin@example.com" }));
    expect(response.status).toBe(403);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
