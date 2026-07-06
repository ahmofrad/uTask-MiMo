import { NextResponse } from "next/server";
import { samlProvider } from "@/lib/auth/providers/saml";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = checkRateLimit(`auth-saml:${ip}`, {
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

  try {
    const { redirectUrl } = await samlProvider.startLogin();
    return NextResponse.redirect(redirectUrl, 302);
  } catch {
    return NextResponse.redirect("/login?error=saml_not_configured", 302);
  }
}
