import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { getMailTemplates, renderTemplate, MAIL_PREVIEW_VARS } from "@/lib/mail/templates";
import { sendMail, isMailConfigured } from "@/lib/mail/send";
import { sendTestEmailSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = sendTestEmailSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  if (!(await isMailConfigured())) {
    return NextResponse.json(
      { error: { code: "SMTP_NOT_CONFIGURED", message: "SMTP is not configured" } },
      { status: 400 },
    );
  }

  const templates = await getMailTemplates();
  const tpl = templates[parsed.data.key === "reset" ? "passwordReset" : "invite"];

  try {
    await sendMail({
      to: parsed.data.to,
      subject: renderTemplate(tpl.subject, MAIL_PREVIEW_VARS),
      text: renderTemplate(tpl.text, MAIL_PREVIEW_VARS),
      html: renderTemplate(tpl.html, MAIL_PREVIEW_VARS),
    });
  } catch {
    return NextResponse.json(
      { error: { code: "MAIL_SEND_FAILED", message: "Failed to send the test email" } },
      { status: 502 },
    );
  }

  await logAudit({
    actorUserId: userId,
    action: "mail_test_sent",
    entityType: "settings",
    entityId: "email-templates",
    after: { template: parsed.data.key, to: parsed.data.to },
  });

  return NextResponse.json({ data: { sent: true } });
}
