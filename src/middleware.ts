import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";

const locales = ["fa-IR", "en-US"] as const;
const defaultLocale = "fa-IR";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: true,
});

const PUBLIC_PREFIXES = ["/api/", "/_next/", "/favicon.ico"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((r) => pathname.startsWith(r));
}

export default async function middleware(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  const responseInit = { request: { headers: requestHeaders } };

  const { pathname } = req.nextUrl;

  // Skip locale + auth handling for API, static, etc.
  if (isPublic(pathname)) {
    return applySecurityHeaders(NextResponse.next(responseInit));
  }

  // First: apply locale detection/redirect from next-intl
  const intlResponse = intlMiddleware(req);
  if (intlResponse) {
    intlResponse.headers.set("x-request-id", requestId);
    return applySecurityHeaders(intlResponse);
  }

  // Auth check: redirect unauthenticated users to locale-appropriate login
  const { auth } = await import("@/lib/auth/config");
  const session = await auth();
  if (!session) {
    const locale = pathname.startsWith("/en-US") ? "en-US" : "fa-IR";
    const loginUrl = new URL(locale === "en-US" ? "/en-US/login" : "/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return applySecurityHeaders(
      NextResponse.redirect(loginUrl, { headers: { "x-request-id": requestId } }),
    );
  }

  return applySecurityHeaders(NextResponse.next(responseInit));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
