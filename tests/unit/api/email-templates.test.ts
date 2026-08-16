import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockUpdateSettings = vi.fn();
const mockLogAudit = vi.fn();
const mockGetMailTemplates = vi.fn();

vi.mock("@/lib/rbac/middleware", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));
vi.mock("@/lib/settings", () => ({
  updateSettings: mockUpdateSettings,
  getSettings: vi.fn(),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/mail/templates", () => ({
  getMailTemplates: mockGetMailTemplates,
}));

const route = await import("@/app/api/v1/admin/settings/email-templates/route");

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
  return new Request("http://localhost/api/v1/admin/settings/email-templates", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authGuardOk();
  mockUpdateSettings.mockResolvedValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
  mockGetMailTemplates.mockResolvedValue(DEFAULT_TEMPLATES);
});

describe("GET /api/v1/admin/settings/email-templates", () => {
  it("returns the effective templates in flat form", async () => {
    const response = await route.GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      invite_subject: "You've been invited to uTask",
      invite_text: "Text {{link}}",
      invite_html: "<p>{{link}}</p>",
      reset_subject: "Reset your uTask password",
      reset_text: "Reset {{link}}",
      reset_html: "",
    });
  });

  it("denies users without org:settings", async () => {
    mockRequirePermission.mockReturnValue(
      vi.fn().mockResolvedValue(new NextResponse(null, { status: 403 })),
    );
    const response = await route.GET();
    expect(response.status).toBe(403);
  });
});

describe("PUT /api/v1/admin/settings/email-templates", () => {
  it("stores the templates under mailTemplates and audits", async () => {
    const response = await route.PUT(jsonRequest({
      invite_subject: "Join the team!",
      invite_text: "Hi {{email}}, accept at {{link}} ({{expiryDays}} days)",
      invite_html: "<p><a href=\"{{link}}\">Join</a></p>",
      reset_subject: "Reset",
      reset_text: "Reset {{link}}",
    }));

    expect(response.status).toBe(200);
    expect(mockUpdateSettings).toHaveBeenCalledWith("install", null, {
      mailTemplates: {
        invite: {
          subject: "Join the team!",
          text: "Hi {{email}}, accept at {{link}} ({{expiryDays}} days)",
          html: "<p><a href=\"{{link}}\">Join</a></p>",
        },
        passwordReset: {
          subject: "Reset",
          text: "Reset {{link}}",
          html: "",
        },
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: ADMIN_ID,
      action: "updated",
      entityType: "settings",
      entityId: "email-templates",
    }));
  });

  it("rejects unknown fields", async () => {
    const response = await route.PUT(jsonRequest({
      invite_subject: "Join",
      invite_text: "Text",
      other_field: "nope",
    }));
    expect(response.status).toBe(400);
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it("denies users without org:settings", async () => {
    mockRequirePermission.mockReturnValue(
      vi.fn().mockResolvedValue(new NextResponse(null, { status: 403 })),
    );
    const response = await route.PUT(jsonRequest({
      invite_subject: "Join",
      invite_text: "Text",
      reset_subject: "Reset",
      reset_text: "Text",
    }));
    expect(response.status).toBe(403);
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });
});
