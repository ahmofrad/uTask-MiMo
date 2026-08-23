import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { enrollTotp, confirmTotpEnrollment, disableTotp } from "@/lib/auth/two-factor";
import { problemResponse } from "@/lib/api/problem";

export async function POST(_request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return problemResponse(_request, 401, "UNAUTHORIZED", "Authentication required");
  }

  const body = await _request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === "enable") {
    return handleEnable(session.user.id, session.user.email ?? "");
  }

  if (action === "verify") {
    return handleVerify(session.user.id, body.token as string | undefined);
  }

  if (action === "disable") {
    return handleDisable(session.user.id);
  }

  return problemResponse(_request, 400, "INVALID_ACTION", 'Valid actions: "enable", "verify", "disable"');
}

async function handleEnable(userId: string, email: string) {
  try {
    const result = await enrollTotp(userId, email);
    return NextResponse.json({ data: { secret: result.secret, uri: result.uri } });
  } catch (err) {
    return problemResponse(null as unknown as Request, 500, "TOTP_ENROLL_FAILED", "Failed to generate TOTP secret");
  }
}

async function handleVerify(userId: string, token: string | undefined) {
  if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
    return problemResponse(null as unknown as Request, 400, "INVALID_TOKEN", "A 6-digit TOTP code is required");
  }

  const result = await confirmTotpEnrollment(userId, token);
  if ("error" in result) {
    return problemResponse(null as unknown as Request, 400, "TOTP_VERIFY_FAILED", result.error);
  }

  return NextResponse.json({
    data: {
      enabled: true,
      recoveryCodes: result.plainCodes,
    },
  });
}

async function handleDisable(userId: string) {
  await disableTotp(userId);
  return NextResponse.json({ data: { enabled: false } });
}