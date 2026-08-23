import { NextResponse } from "next/server";
import { lookupToken, tokenHasScope } from "@/lib/api-token";
import { checkRateLimitIp, checkRateLimitToken, checkRateLimitUser } from "@/lib/rate-limit";


export type PublicApiRateLimit = {
  limit: number;
  remaining: number;
  reset: number;
};

export type PublicApiAuthResult = {
  userId: string;
  rateLimit?: PublicApiRateLimit;
  error?: NextResponse;
};

export function withPublicApiRateLimit(response: NextResponse, rateLimit?: PublicApiRateLimit): NextResponse {
  if (rateLimit) {
    for (const [key, value] of Object.entries(rateLimitHeaders(rateLimit.limit, rateLimit.remaining, rateLimit.reset))) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export async function authenticatePublicApi(
  request: Request,
  requiredScope?: string,
): Promise<PublicApiAuthResult> {
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

  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? realIp ?? "unknown";
  const [ipResult, userResult, tokenResult] = await Promise.all([
    checkRateLimitIp(clientIp),
    checkRateLimitUser(token.userId),
    checkRateLimitToken(token.id),
  ]);
  const blocked = [ipResult, userResult, tokenResult].find((result) => !result.allowed);
  if (blocked) {
    return {
      userId: "",
      error: NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        {
          status: 429,
          headers: rateLimitHeaders(blocked.limit, blocked.remaining, Math.ceil((blocked.resetAt - Date.now()) / 1000)),
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

  return {
    userId: token.userId,
    rateLimit: {
      limit: tokenResult.limit,
      remaining: Math.min(ipResult.remaining, userResult.remaining, tokenResult.remaining),
      reset: Math.ceil((Math.max(ipResult.resetAt, userResult.resetAt, tokenResult.resetAt) - Date.now()) / 1000),
    },
  };
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
