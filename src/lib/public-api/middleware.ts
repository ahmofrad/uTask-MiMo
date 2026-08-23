import { NextResponse } from "next/server";
import { lookupToken, tokenHasScope } from "@/lib/api-token";
import { checkRateLimitIp, checkRateLimitToken, checkRateLimitUser } from "@/lib/rate-limit";
import { getOrganizationContext } from "@/lib/organizations/context";
import { problemResponse } from "@/lib/api/problem";


export type PublicApiRateLimit = {
  limit: number;
  remaining: number;
  reset: number;
};

export type PublicApiAuthResult = {
  userId: string;
  organizationId: string;
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
      organizationId: "",
      error: problemResponse(request, 401, "UNAUTHORIZED", "Missing or invalid Authorization header"),
    };
  }

  const rawToken = authHeader.slice(7);
  const token = await lookupToken(rawToken);

  if (!token) {
    return {
      userId: "",
      organizationId: "",
      error: problemResponse(request, 401, "UNAUTHORIZED", "Invalid or revoked token"),
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
      organizationId: "",
      error: (() => {
        const response = problemResponse(request, 429, "RATE_LIMITED", "Too many requests");
        for (const [key, value] of Object.entries(rateLimitHeaders(blocked.limit, blocked.remaining, Math.ceil((blocked.resetAt - Date.now()) / 1000)))) response.headers.set(key, value);
        return response;
      })(),
    };
  }

  if (requiredScope && !tokenHasScope(token.scopes, requiredScope)) {
    return {
      userId: "",
      organizationId: "",
      error: problemResponse(request, 403, "FORBIDDEN", `Token requires scope: ${requiredScope}`),
    };
  }

  const requestedOrganizationId = request.headers.get("x-organization-id")?.trim();
  if (requestedOrganizationId && requestedOrganizationId !== token.organizationId) {
    return {
      userId: "",
      organizationId: "",
      error: problemResponse(request, 403, "ORGANIZATION_ACCESS_DENIED", "This token is bound to a different organization"),
    };
  }
  const organization = await getOrganizationContext(token.userId, token.organizationId);
  if (!organization) {
    return {
      userId: "",
      organizationId: "",
      error: problemResponse(request, 403, "ORGANIZATION_ACCESS_DENIED", "You do not have access to this organization"),
    };
  }

  return {
    userId: token.userId,
    organizationId: organization.organizationId,
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
