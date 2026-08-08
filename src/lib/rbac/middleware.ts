import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { can, canProject } from "@/lib/rbac/can";
import type { Permission } from "@/lib/rbac/roles";
import { checkRateLimitIp, checkRateLimitUser, formatHeaders } from "@/lib/rate-limit";

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
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429, headers },
    );
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
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const rateLimitResponse = await enforceRateLimit(_request, session.user.id);
  if (rateLimitResponse) return rateLimitResponse;
  return { userId: session.user.id };
}

export function requirePermission(permission: Permission): Middleware {
  return async (_request: Request, _context: RouteContext) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 },
      );
    }
    const rateLimitResponse = await enforceRateLimit(_request, session.user.id);
    if (rateLimitResponse) return rateLimitResponse;
    const permitted = await can(session.user.id, permission);
    if (!permitted) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
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
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 },
      );
    }
    const rateLimitResponse = await enforceRateLimit(_request, session.user.id);
    if (rateLimitResponse) return rateLimitResponse;
    const projectId = await getProjectId(context);
    const permitted = await canProject(session.user.id, permission, projectId);
    if (!permitted) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }
    return null;
  };
}

export function requireAnyPermission(permissions: Permission[]): Middleware {
  return async (_request: Request, _context: RouteContext) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 },
      );
    }
    const rateLimitResponse = await enforceRateLimit(_request, session.user.id);
    if (rateLimitResponse) return rateLimitResponse;
    for (const permission of permissions) {
      if (await can(session.user.id, permission)) return null;
    }
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
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
