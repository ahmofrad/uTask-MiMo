import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimitIp, checkRateLimitToken, formatHeaders } from "./index";
import { logger } from "@/lib/logging";

export async function applyRateLimit(
  req: NextRequest,
): Promise<{ response?: NextResponse; headers: Record<string, string> } | null> {
  const pathname = req.nextUrl.pathname;

  // Skip rate limiting for non-API routes
  if (!pathname.startsWith("/api/")) return null;

  // Skip rate limiting for public API (has its own token-based limits)
  if (pathname.startsWith("/api/v1/public/")) return null;

  // Extract client IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? req.ip ?? "unknown";

  // Try token-based rate limit first (Bearer token from Authorization header)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    // Hash the full token to get a unique, fixed-length key (Edge-compatible)
    const tokenBytes = new TextEncoder().encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBytes);
    const hashArray = new Uint8Array(hashBuffer);
    const tokenKey = Array.from(hashArray.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const result = await checkRateLimitToken(tokenKey);
    const headers = formatHeaders(result);
    if (!result.allowed) {
      logger.warn({ ip: clientIp, tier: "token" }, "Rate limit exceeded (token)");
      return {
        response: NextResponse.json(
          { error: { code: "RATE_LIMITED", message: "Too many requests" } },
          { status: 429, headers },
        ),
        headers,
      };
    }
    return { headers };
  }

  // For authenticated session-based requests, check user tier
  // We can't call auth() here (it's in middleware already), so we check if a session cookie exists
  // and use IP as fallback. The user-level check happens in API routes that can call auth().
  // For now, apply IP-based rate limiting.
  const result = await checkRateLimitIp(clientIp);
  const headers = formatHeaders(result);
  if (!result.allowed) {
    logger.warn({ ip: clientIp, tier: "ip" }, "Rate limit exceeded (IP)");
    return {
      response: NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429, headers },
      ),
      headers,
    };
  }

  return { headers };
}
