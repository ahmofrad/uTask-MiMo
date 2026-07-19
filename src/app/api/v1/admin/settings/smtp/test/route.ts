import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Authenticated user has no email address" } },
      { status: 400 },
    );
  }

  const allSettings = await getSettings("install", null);
  const smtp = (allSettings.smtp ?? {}) as Record<string, unknown>;
  if (!smtp.host || typeof smtp.host !== "string") {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "SMTP is not configured. Set host, port, and credentials first." } },
      { status: 400 },
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const host = (body.smtp_host as string) || (smtp.host as string);
  const port = Number((body.smtp_port as string) ?? (smtp.port as number) ?? 587);
  const user_ = (body.smtp_user as string) || (smtp.user as string) || undefined;
  const pass = (body.smtp_pass as string) || (smtp.pass as string) || undefined;
  const from = (body.smtp_from as string) || (smtp.from as string) || undefined;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user_ && pass ? { user: user_, pass } : undefined,
  });

  let verifyError: string | null = null;
  try {
    await transport.verify();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error during connection verification";
    verifyError = message;
  }

  if (verifyError) {
    return NextResponse.json({
      data: { success: false, stage: "connect", error: verifyError },
    });
  }

  let sendError: string | null = null;
  try {
    await transport.sendMail({
      from: from || "noreply@utask.local",
      to: user.email,
      subject: "uTask — SMTP Test",
      text: "This is a test email from uTask. If you received this, your SMTP configuration is working correctly.",
      html: "<p>This is a test email from uTask. If you received this, your SMTP configuration is working correctly.</p>",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error during send";
    sendError = message;
  }

  if (sendError) {
    return NextResponse.json({
      data: { success: false, stage: "send", error: sendError },
    });
  }

  return NextResponse.json({
    data: { success: true, message: `Test email sent to ${user.email}` },
  });
}
