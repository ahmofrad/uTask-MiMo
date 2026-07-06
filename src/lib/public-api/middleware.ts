import { NextResponse } from "next/server";
import { lookupToken, tokenHasScope } from "@/lib/api-token";
import { checkRateLimit } from "@/lib/rate-limit";

const TOKEN_LIMIT = { windowMs: 60000, maxRequests: 60 };

export async function authenticatePublicApi(
  request: Request,
  requiredScope?: string,
): Promise<{ userId: string; error?: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      userId: "",
      error: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" } },
        { status: 401 },
      ),
    };
  }

  const rawToken = authHeader.slice(7);
  const token = await lookupToken(rawToken);

  if (!token) {
    return {
      userId: "",
      error: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or revoked token" } },
        { status: 401 },
      ),
    };
  }

  // Rate limit per token
  const rl = await checkRateLimit(`token:${token.id}`, TOKEN_LIMIT);
  if (!rl.allowed) {
    return {
      userId: "",
      error: NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        {
          status: 429,
          headers: rateLimitHeaders(TOKEN_LIMIT.maxRequests, rl.remaining, Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      ),
    };
  }

  if (requiredScope && !tokenHasScope(token.scopes, requiredScope)) {
    return {
      userId: "",
      error: NextResponse.json(
        { error: { code: "FORBIDDEN", message: `Token requires scope: ${requiredScope}` } },
        { status: 403 },
      ),
    };
  }

  return { userId: token.userId };
}

export function rateLimitHeaders(
  limit: number,
  remaining: number,
  reset: number,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(reset),
  };
}
