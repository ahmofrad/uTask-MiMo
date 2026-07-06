import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";
import { applyRateLimit } from "@/lib/rate-limit/middleware";

const locales = ["fa-IR", "en-US"] as const;
const defaultLocale = "fa-IR";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: true,
});

const PUBLIC_PREFIXES = ["/api/", "/_next/", "/favicon.ico"];
const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const STATE_METHODS = ["POST", "PATCH", "DELETE", "PUT"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((r) => pathname.startsWith(r));
}

function isPublicApi(pathname: string): boolean {
  return pathname.startsWith("/api/v1/public/");
}

export default async function middleware(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  const responseInit = { request: { headers: requestHeaders } };

  const { pathname } = req.nextUrl;

  // Skip locale + auth handling for API, static, etc.
  if (isPublic(pathname)) {
    // CSRF: validate on state-changing API requests (skip public API with Bearer tokens)
    if (!isPublicApi(pathname) && STATE_METHODS.includes(req.method)) {
      const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
      const headerToken = requestHeaders.get(CSRF_HEADER);

      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: { code: "CSRF_INVALID", message: "Missing or invalid CSRF token" } },
            { status: 403 },
          ),
        );
      }
    }

    // Rate limiting for internal API routes only (not public API)
    if (!isPublicApi(pathname) && pathname.startsWith("/api/")) {
      const rateLimitResult = await applyRateLimit(req);
      if (rateLimitResult?.response) {
        return applySecurityHeaders(rateLimitResult.response);
      }
    }

    const res = applySecurityHeaders(NextResponse.next(responseInit));

    // Set CSRF cookie on safe methods so the client can read it
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) && !isPublicApi(pathname)) {
      const existingToken = req.cookies.get(CSRF_COOKIE)?.value;
      if (!existingToken) {
        const token = crypto.randomUUID();
        res.cookies.set(CSRF_COOKIE, token, {
          httpOnly: false, // Client JS needs to read it
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60 * 24, // 1 day
        });
      }
    }

    return res;
  }

  // First: apply locale detection/redirect from next-intl
  const intlResponse = intlMiddleware(req);
  if (intlResponse) {
    intlResponse.headers.set("x-request-id", requestId);

    // CSRF: set cookie on safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const existingToken = req.cookies.get(CSRF_COOKIE)?.value;
      if (!existingToken) {
        const token = crypto.randomUUID();
        intlResponse.cookies.set(CSRF_COOKIE, token, {
          httpOnly: false,
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60 * 24,
        });
      }
    }

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
