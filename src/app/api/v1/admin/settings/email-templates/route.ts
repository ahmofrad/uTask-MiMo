import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { updateSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit/log";
import { getMailTemplates } from "@/lib/mail/templates";
import { emailTemplatesSchema, readJsonBody, validationError } from "@/lib/validation/api";

const KEY_MAP: Record<string, { template: "invite" | "passwordReset"; field: "subject" | "text" | "html" }> = {
  invite_subject: { template: "invite", field: "subject" },
  invite_text: { template: "invite", field: "text" },
  invite_html: { template: "invite", field: "html" },
  reset_subject: { template: "passwordReset", field: "subject" },
  reset_text: { template: "passwordReset", field: "text" },
  reset_html: { template: "passwordReset", field: "html" },
};

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const templates = await getMailTemplates();
  const data: Record<string, string> = {};
  for (const [key, { template, field }] of Object.entries(KEY_MAP)) {
    const tpl = templates[template];
    data[key] = tpl ? tpl[field] : "";
  }

  return NextResponse.json({ data });
}

export async function PUT(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = emailTemplatesSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const build = (template: "invite" | "passwordReset") => ({
    subject: parsed.data[`${template === "invite" ? "invite" : "reset"}_subject`],
    text: parsed.data[`${template === "invite" ? "invite" : "reset"}_text`],
    html: parsed.data[`${template === "invite" ? "invite" : "reset"}_html`] ?? "",
  });

  await updateSettings("install", null, {
    mailTemplates: {
      invite: build("invite"),
      passwordReset: build("passwordReset"),
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "settings",
    entityId: "email-templates",
    after: { inviteSubject: parsed.data.invite_subject, resetSubject: parsed.data.reset_subject },
  });

  return NextResponse.json({ data: { success: true } });
}
