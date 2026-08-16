import { NextResponse } from "next/server";
import { ldapAuth } from "@/lib/auth/providers/ldap";
import { signIn } from "@/lib/auth/config";
import { createSsoToken } from "@/lib/auth/sso-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit/log";
import { ldapLoginSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = await checkRateLimit(`auth-ldap:${ip}`, {
    windowMs: 60000,
    maxRequests: 10,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many login attempts. Try again later.",
        },
      },
      { status: 429 },
    );
  }

  const parsed = ldapLoginSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { username, password, sourceId } = parsed.data;

  const result = await ldapAuth(username, password, sourceId);

  if (!result.success) {
    await logAudit({
      actorUserId: null,
      action: "login_failed",
      entityType: "user",
      entityId: "",
      after: { provider: "ldap", username, sourceId, reason: result.error },
    });

    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid username or password",
        },
      },
      { status: 401 },
    );
  }

  try {
    const signInResult = await signIn("credentials", {
      email: result.user!.email,
      password: "",
      ssoToken: createSsoToken(result.user!.email, "ldap"),
      redirect: false,
    });

    if (signInResult?.error) {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_ERROR",
            message: "Failed to create session",
          },
        },
        { status: 500 },
      );
    }

    await logAudit({
      actorUserId: result.user!.id,
      action: "login_success",
      entityType: "user",
      entityId: result.user!.id,
      after: { provider: "ldap", sourceId },
    });

    return NextResponse.json({ data: { success: true } });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_ERROR",
          message: "Failed to create session",
        },
      },
      { status: 500 },
    );
  }
}
