import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { can, canProject } from "@/lib/rbac/can";
import type { Permission } from "@/lib/rbac/roles";

type RouteContext = { params: Record<string, string | string[]> };
type MiddlewareResult = NextResponse | null;
type Middleware = (_request: Request, _context: RouteContext) => Promise<MiddlewareResult>;

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
