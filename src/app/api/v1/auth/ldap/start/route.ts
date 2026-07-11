import { NextResponse } from "next/server";
import { ldapAuth } from "@/lib/auth/providers/ldap";
import { signIn } from "@/lib/auth/config";
import { createSsoToken } from "@/lib/auth/sso-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit/log";

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

  const body = await request.json();
  const { username, password } = body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "username and password are required",
        },
      },
      { status: 400 },
    );
  }

  const result = await ldapAuth(username, password);

  if (!result.success) {
    await logAudit({
      actorUserId: null,
      action: "login_failed",
      entityType: "user",
      entityId: "",
      after: { provider: "ldap", username, reason: result.error },
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
      after: { provider: "ldap" },
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
