import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { sha256 } from "@/lib/crypto";
import { passwordResetSchema } from "@/lib/validation/api";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid reset request" } }, { status: 400 });
  }

  const parsed = passwordResetSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: parsed.error.issues[0]?.message ?? "VALIDATION_ERROR" } }, { status: 400 });
  }

  const tokenHash = sha256(parsed.data.token);
  const verificationToken = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!verificationToken || verificationToken.expires <= new Date()) {
    return NextResponse.json({ error: { code: "INVALID_RESET_TOKEN", message: "Reset link is invalid or expired" } }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: verificationToken.identifier },
    select: { id: true, status: true },
  });
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: { code: "INVALID_RESET_TOKEN", message: "Reset link is invalid or expired" } }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.verificationToken.delete({ where: { token: tokenHash } }),
  ]);

  await logAudit({
    actorUserId: user.id,
    actorIp: request.headers.get("x-real-ip") ?? "",
    action: "password_changed",
    entityType: "user",
    entityId: user.id,
    after: { method: "password_reset" },
    requestId: request.headers.get("x-request-id") ?? "",
  });

  return NextResponse.json({ data: { success: true } });
}
