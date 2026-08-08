import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { sendMail } from "@/lib/mail/send";
import { randomHex, sha256 } from "@/lib/crypto";
import { logger } from "@/lib/logging";
import { passwordResetRequestSchema, readJsonBody, validationError } from "@/lib/validation/api";

const RESET_TTL_MS = 60 * 60 * 1000;

function genericResponse() {
  return NextResponse.json({ data: { success: true } });
}

function resetUrl(request: Request, token: string): string {
  const configuredOrigin = process.env.AUTH_URL?.trim();
  const origin = configuredOrigin ? new URL(configuredOrigin).origin : new URL(request.url).origin;
  return new URL(`/reset-password/${encodeURIComponent(token)}`, origin).toString();
}

export async function POST(request: Request) {
  const parsed = passwordResetRequestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });

  // Do not reveal whether an email is registered.
  if (!user || user.status !== "active") return genericResponse();

  const requestId = request.headers.get("x-request-id") ?? "";
  try {
    const rawToken = randomHex(32);
    const tokenHash = sha256(rawToken);
    const expires = new Date(Date.now() + RESET_TTL_MS);

    await prisma.verificationToken.deleteMany({ where: { identifier: user.id } });
    await prisma.verificationToken.create({
      data: { identifier: user.id, token: tokenHash, expires },
    });

    await logAudit({
      actorUserId: user.id,
      actorIp: request.headers.get("x-real-ip") ?? "",
      action: "password_reset_requested",
      entityType: "user",
      entityId: user.id,
      after: { method: "email" },
      requestId,
    });

    const url = resetUrl(request, rawToken);
    await sendMail({
      to: user.email,
      subject: "Reset your uTask password",
      text: `Use this link to reset your password. It expires in one hour:\n\n${url}`,
      html: `<p>Use this link to reset your password. It expires in one hour:</p><p><a href="${url}">Reset password</a></p>`,
    });
  } catch {
    logger.error({ requestId }, "Password reset processing failed");
  }

  return genericResponse();
}
