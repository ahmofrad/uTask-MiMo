import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { sha256 } from "@/lib/crypto";
import { signIn } from "@/lib/auth/config";
import { logger } from "@/lib/logging";
import { inviteAcceptSchema } from "@/lib/validation/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid invite request" } },
      { status: 400 },
    );
  }

  const parsed = inviteAcceptSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Display name and password are required" } },
      { status: 400 },
    );
  }

  const tokenHash = sha256(token);
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });
  if (!verificationToken || verificationToken.expires <= new Date()) {
    return NextResponse.json(
      { error: { code: "INVALID_INVITE_TOKEN", message: "Invite link is invalid or expired" } },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: verificationToken.identifier },
    select: { id: true, email: true, status: true },
  });
  if (!user || user.status !== "invited") {
    return NextResponse.json(
      { error: { code: "INVALID_INVITE_TOKEN", message: "Invite link is invalid or expired" } },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { displayName: parsed.data.displayName, passwordHash, status: "active" },
    }),
    prisma.verificationToken.delete({ where: { token: tokenHash } }),
  ]);

  await logAudit({
    actorUserId: user.id,
    actorIp: request.headers.get("x-real-ip") ?? "",
    action: "invite_accepted",
    entityType: "user",
    entityId: user.id,
    after: { displayName: parsed.data.displayName, method: "invite" },
    requestId: request.headers.get("x-request-id") ?? "",
  });

  // Activate the session so the accept page can drop the user into the app.
  try {
    const result = await signIn("credentials", {
      email: user.email,
      password: parsed.data.password,
      redirect: false,
    });
    if (result?.error) {
      logger.warn({ userId: user.id }, "Invite accepted but session creation failed");
    }
  } catch (error) {
    logger.warn({ error, userId: user.id }, "Invite accepted but session creation failed");
  }

  return NextResponse.json({ data: { success: true } });
}
