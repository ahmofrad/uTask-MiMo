import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { can, canProject } from "@/lib/rbac/can";
import type { Permission } from "@/lib/rbac/roles";
import { checkRateLimitIp, checkRateLimitUser, formatHeaders } from "@/lib/rate-limit";
import { problemResponse } from "@/lib/api/problem";

type RouteContext = { params: Record<string, string | string[]> };
type MiddlewareResult = NextResponse | null;
type Middleware = (_request: Request, _context: RouteContext) => Promise<MiddlewareResult>;
const rateLimitedRequests = new WeakSet<Request>();

async function enforceRateLimit(request: Request, userId: string): Promise<NextResponse | null> {
  if (rateLimitedRequests.has(request)) return null;

  const realIp = request.headers.get("x-real-ip");
  const clientIp = process.env.TRUST_PROXY === "true" && realIp?.trim() ? realIp.trim() : "untrusted-client";
  const [ipResult, userResult] = await Promise.all([
    checkRateLimitIp(clientIp),
    checkRateLimitUser(userId),
  ]);
  const headers = formatHeaders(ipResult);
  if (!ipResult.allowed || !userResult.allowed) {
    const response = problemResponse(request, 429, "RATE_LIMITED", "Too many requests");
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }
  rateLimitedRequests.add(request);
  return null;
}

export async function requireAuth(
  _request: Request,
  _context: RouteContext,
): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return problemResponse(_request, 401, "UNAUTHORIZED", "Authentication required");
  }
  const rateLimitResponse = await enforceRateLimit(_request, session.user.id);
  if (rateLimitResponse) return rateLimitResponse;
  return { userId: session.user.id };
}

export function requirePermission(permission: Permission): Middleware {
  return async (_request: Request, _context: RouteContext) => {
    const session = await auth();
    if (!session?.user?.id) {
      return problemResponse(_request, 401, "UNAUTHORIZED", "Authentication required");
    }
    const rateLimitResponse = await enforceRateLimit(_request, session.user.id);
    if (rateLimitResponse) return rateLimitResponse;
    const permitted = await can(session.user.id, permission);
    if (!permitted) {
      return problemResponse(_request, 403, "FORBIDDEN", "Insufficient permissions");
    }
    return null;
  };
}

export function requireProjectPermission(
  permission: Permission,
  getProjectId: (_context: RouteContext) => string | Promise<string>,
): Middleware {
  return async (_request: Request, context: RouteContext) => {
    const session = await auth();
    if (!session?.user?.id) {
      return problemResponse(_request, 401, "UNAUTHORIZED", "Authentication required");
    }
    const rateLimitResponse = await enforceRateLimit(_request, session.user.id);
    if (rateLimitResponse) return rateLimitResponse;
    const projectId = await getProjectId(context);
    const permitted = await canProject(session.user.id, permission, projectId);
    if (!permitted) {
      return problemResponse(_request, 403, "FORBIDDEN", "Insufficient permissions");
    }
    return null;
  };
}

export function requireAnyPermission(permissions: Permission[]): Middleware {
  return async (_request: Request, _context: RouteContext) => {
    const session = await auth();
    if (!session?.user?.id) {
      return problemResponse(_request, 401, "UNAUTHORIZED", "Authentication required");
    }
    const rateLimitResponse = await enforceRateLimit(_request, session.user.id);
    if (rateLimitResponse) return rateLimitResponse;
    for (const permission of permissions) {
      if (await can(session.user.id, permission)) return null;
    }
    return problemResponse(_request, 403, "FORBIDDEN", "Insufficient permissions");
  };
}

export function composeMiddleware(
  ...middlewares: Middleware[]
): Middleware {
  return async (request: Request, context: RouteContext) => {
    for (const middleware of middlewares) {
      const result = await middleware(request, context);
      if (result) return result;
    }
    return null;
  };
}

export type { Middleware, RouteContext };
