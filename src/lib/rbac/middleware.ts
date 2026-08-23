import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { can, canProject } from "@/lib/rbac/can";
import type { Permission } from "@/lib/rbac/roles";
import { checkRateLimitIp, checkRateLimitUser, formatHeaders } from "@/lib/rate-limit";
import { problemResponse } from "@/lib/api/problem";
import { getOrganizationContext, getRequestedOrganizationId } from "@/lib/organizations/context";

type RouteContext = { params: Record<string, string | string[]> };
type AuthResult = { userId: string; organizationId: string; organizationRole: "owner" | "admin" | "member" };
type MiddlewareResult = NextResponse | null;
type Middleware = (_request: Request, _context: RouteContext) => Promise<MiddlewareResult>;
const rateLimitedRequests = new WeakSet<Request>();

function normalizeRequest(request: Request | undefined): Request {
  return request ?? new Request("http://localhost/api/v1");
}

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

async function authenticateRequest(request: Request): Promise<AuthResult | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return problemResponse(request, 401, "UNAUTHORIZED", "Authentication required");
  }
  const rateLimitResponse = await enforceRateLimit(request, session.user.id);
  if (rateLimitResponse) return rateLimitResponse;
  const organization = await getOrganizationContext(session.user.id, getRequestedOrganizationId(request));
  if (!organization) return problemResponse(request, 403, "ORGANIZATION_ACCESS_DENIED", "You do not have access to this organization");
  return { userId: session.user.id, ...organization };
}

export async function requireAuth(
  request: Request,
  _context: RouteContext,
): Promise<AuthResult | NextResponse> {
  return authenticateRequest(normalizeRequest(request));
}

export function requirePermission(permission: Permission): Middleware {
  return async (rawRequest: Request, _context: RouteContext) => {
    const request = normalizeRequest(rawRequest);
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) return authResult;
    const permitted = await can(authResult.userId, permission, authResult.organizationId);
    if (!permitted) return problemResponse(request, 403, "FORBIDDEN", "Insufficient permissions");
    return null;
  };
}

export function requireProjectPermission(
  permission: Permission,
  getProjectId: (_context: RouteContext) => string | Promise<string>,
): Middleware {
  return async (rawRequest: Request, context: RouteContext) => {
    const request = normalizeRequest(rawRequest);
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) return authResult;
    const projectId = await getProjectId(context);
    const permitted = await canProject(authResult.userId, permission, projectId, authResult.organizationId);
    if (!permitted) return problemResponse(request, 403, "FORBIDDEN", "Insufficient permissions");
    return null;
  };
}

export function requireAnyPermission(permissions: Permission[]): Middleware {
  return async (rawRequest: Request, _context: RouteContext) => {
    const request = normalizeRequest(rawRequest);
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) return authResult;
    for (const permission of permissions) {
      if (await can(authResult.userId, permission, authResult.organizationId)) return null;
    }
    return problemResponse(request, 403, "FORBIDDEN", "Insufficient permissions");
  };
}

export function composeMiddleware(...middlewares: Middleware[]): Middleware {
  return async (request: Request, context: RouteContext) => {
    for (const middleware of middlewares) {
      const result = await middleware(request, context);
      if (result) return result;
    }
    return null;
  };
}

export type { Middleware, RouteContext };
