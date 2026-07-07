import { NextResponse } from "next/server";
import { samlProvider } from "@/lib/auth/providers/saml";
import { signIn } from "@/lib/auth/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = await checkRateLimit(`auth-saml:${ip}`, {
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

  const formData = await request.formData();
  const samlResponse = formData.get("SAMLResponse") as string | null;

  if (!samlResponse) {
    return NextResponse.redirect("/login?error=missing_saml_response", 302);
  }

  const result = await samlProvider.handleCallback(samlResponse);

  if (!result.success) {
    await logAudit({
      actorUserId: null,
      action: "login_failed",
      entityType: "user",
      entityId: "",
      after: { provider: "saml", reason: result.error },
    });

    return NextResponse.redirect(
      `/login?error=saml_auth_failed&message=${encodeURIComponent(result.error ?? "Unknown error")}`,
      302,
    );
  }

  try {
    const signInResult = await signIn("credentials", {
      email: result.user!.email,
      password: "",
      _ssoVerified: true,
      redirect: false,
    });

    if (signInResult?.error) {
      return NextResponse.redirect(
        "/login?error=session_error",
        302,
      );
    }

    await logAudit({
      actorUserId: result.user!.id,
      action: "login_success",
      entityType: "user",
      entityId: result.user!.id,
      after: { provider: "saml" },
    });

    return NextResponse.redirect("/", 302);
  } catch {
    return NextResponse.redirect("/login?error=session_error", 302);
  }
}
