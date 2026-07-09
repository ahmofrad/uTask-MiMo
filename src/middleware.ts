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
const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const STATE_METHODS = ["POST", "PATCH", "DELETE", "PUT"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((r) => pathname.startsWith(r));
}

function isPublicApi(pathname: string): boolean {
  return pathname.startsWith("/api/v1/public/");
}

function hasSessionCookie(req: NextRequest): boolean {
  // NextAuth v5 stores session in authjs.session-token cookie
  return Boolean(
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("__Host-authjs.session-token")?.value,
  );
}

export default async function middleware(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  const responseInit = { request: { headers: requestHeaders } };

  const { pathname } = req.nextUrl;

  // Skip locale + auth handling for API, static, etc.
  if (isPublic(pathname)) {
    // CSRF: validate on state-changing API requests
    // Skip public API (Bearer tokens) and NextAuth routes (has own CSRF)
    const isNextAuth = pathname.startsWith("/api/auth/");
    const isSamlCallback = pathname === "/api/v1/auth/saml/callback";
    if (!isPublicApi(pathname) && !isNextAuth && !isSamlCallback && STATE_METHODS.includes(req.method)) {
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

    const res = applySecurityHeaders(NextResponse.next(responseInit));

    // Set CSRF cookie on safe methods so the client can read it
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) && !isPublicApi(pathname)) {
      const existingToken = req.cookies.get(CSRF_COOKIE)?.value;
      if (!existingToken) {
        const token = crypto.randomUUID();
        const isHttps = req.nextUrl.protocol === "https:";
        res.cookies.set(CSRF_COOKIE, token, {
          httpOnly: false,
          secure: isHttps,
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60 * 24, // 1 day
        });
      }
    }

    return res;
  }

  // Auth check FIRST: check session cookie (Edge-compatible, no Prisma)
  // Must run before intl middleware, which otherwise short-circuits the auth check
  const isAuthenticated = hasSessionCookie(req);

  const isLoginPage = pathname === "/login" || pathname === "/en-US/login" || pathname === "/fa-IR/login";

  if (!isAuthenticated && !isLoginPage) {
    const locale = pathname.startsWith("/en-US") ? "en-US" : "fa-IR";
    const loginUrl = new URL(locale === "en-US" ? "/en-US/login" : "/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return applySecurityHeaders(
      NextResponse.redirect(loginUrl, { headers: { "x-request-id": requestId } }),
    );
  }

  // If authenticated and trying to access login, redirect to home
  if (isAuthenticated && isLoginPage) {
    const locale = pathname.startsWith("/en-US") ? "en-US" : "fa-IR";
    const homeUrl = new URL(locale === "en-US" ? "/en-US" : "/", req.url);
    return applySecurityHeaders(
      NextResponse.redirect(homeUrl, { headers: { "x-request-id": requestId } }),
    );
  }

  // Then: apply locale detection/redirect from next-intl
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
          secure: req.nextUrl.protocol === "https:",
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60 * 24,
        });
      }
    }

    return applySecurityHeaders(intlResponse);
  }

  return applySecurityHeaders(NextResponse.next(responseInit));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
