import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { sendMail } from "@/lib/mail/send";
import { randomHex, sha256 } from "@/lib/crypto";
import { logger } from "@/lib/logging";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function inviteUrl(request: Request, token: string): string {
  const configuredOrigin = process.env.AUTH_URL?.trim();
  const origin = configuredOrigin ? new URL(configuredOrigin).origin : new URL(request.url).origin;
  return new URL(`/invite/${encodeURIComponent(token)}`, origin).toString();
}

/**
 * Issue a one-time invite link for an invited user: stores the hashed token,
 * writes the audit entry, and emails the raw link. DB writes are critical and
 * throw on failure; email delivery is best-effort (callers may swallow it).
 */
export async function issueInvite(params: {
  userId: string;
  email: string;
  request: Request;
  actorUserId: string;
  requestId?: string;
}): Promise<void> {
  const rawToken = randomHex(32);
  const tokenHash = sha256(rawToken);
  const expires = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier: params.userId } });
  await prisma.verificationToken.create({
    data: { identifier: params.userId, token: tokenHash, expires },
  });

  await logAudit({
    actorUserId: params.actorUserId,
    actorIp: params.request.headers.get("x-real-ip") ?? "",
    action: "invite_sent",
    entityType: "user",
    entityId: params.userId,
    after: { email: params.email },
    requestId: params.requestId ?? params.request.headers.get("x-request-id") ?? "",
  });

  const url = inviteUrl(params.request, rawToken);
  try {
    await sendMail({
      to: params.email,
      subject: "You've been invited to uTask",
      text: `You've been invited to join uTask. Use this link to set your password and join the team. It expires in 7 days:\n\n${url}`,
      html: `<p>You've been invited to join uTask.</p><p>Use this link to set your password and join the team. It expires in 7 days:</p><p><a href="${url}">Accept invitation</a></p>`,
    });
  } catch (error) {
    logger.error({ error, userId: params.userId }, "Invite email delivery failed");
  }
}
